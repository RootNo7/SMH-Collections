require("dotenv").config();

const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const { db, dataDirectory } = require("./server/db");
const { seedProducts } = require("./server/seed");
const SQLiteSessionStore = require("./server/lib/sqlite-session-store");
const { csrfToken, csrfProtection } = require("./server/lib/security");
const { configured: mailConfigured } = require("./server/lib/mailer");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const PUBLIC_DIR = path.join(__dirname, "public");
const SESSION_SECRET = process.env.SESSION_SECRET || "";

if (!/^[a-f0-9]{64,}$/i.test(SESSION_SECRET)) {
  console.error("Configuration error: SESSION_SECRET must be at least 64 hexadecimal characters. Generate one with node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  process.exit(1);
}
if (!process.env.APP_ORIGIN) {
  console.error("Configuration error: APP_ORIGIN must be set in .env.");
  process.exit(1);
}
try {
  const origin = new URL(process.env.APP_ORIGIN);
  if (origin.pathname !== "/" || origin.search || origin.hash) throw new Error("APP_ORIGIN must not contain a path, query, or fragment.");
  if (IS_PRODUCTION && origin.protocol !== "https:") throw new Error("APP_ORIGIN must use HTTPS in production.");
} catch (error) {
  console.error(`Configuration error: ${error.message}`);
  process.exit(1);
}
if (IS_PRODUCTION && !mailConfigured()) {
  console.error("Configuration error: configure MAIL_HOST, MAIL_USER, MAIL_PASS and MAIL_FROM for production password recovery.");
  process.exit(1);
}
if (IS_PRODUCTION && process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);

seedProducts(db);
app.disable("x-powered-by");
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://images.pexels.com"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: IS_PRODUCTION ? [] : null
    }
  }
}));
app.use(express.json({ limit: "20kb", strict: true }));
app.use(express.urlencoded({ extended: false, limit: "20kb", parameterLimit: 50 }));

const sessionStore = new SQLiteSessionStore(db, { ttlMs: 2 * 60 * 60 * 1000 });
app.use(session({
  name: IS_PRODUCTION ? "__Host-smh.sid" : "smh.sid",
  secret: SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    maxAge: 2 * 60 * 60 * 1000,
    path: "/"
  }
}));

app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." }
}));
app.get("/api/health", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "ok", service: "SMH Collections API" });
});
// This must be registered before CSRF middleware because it establishes the token.
app.get("/api/security/csrf", csrfToken);
app.use("/api", csrfProtection);

app.use("/api/auth", require("./server/routes/auth.routes"));
app.use("/api", require("./server/routes/store.routes"));
app.use("/api", require("./server/routes/contact.routes"));
app.use("/api/admin", require("./server/routes/admin.routes"));
app.use("/api", (req, res) => res.status(404).json({ error: "API route not found." }));

app.use(express.static(PUBLIC_DIR, {
  dotfiles: "deny",
  index: "index.html",
  extensions: ["html"],
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    if (filePath.endsWith(".css") || filePath.endsWith(".js")) res.setHeader("Cache-Control", "public, max-age=3600");
  }
}));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found." });
  res.status(404).sendFile(path.join(PUBLIC_DIR, "404.html"));
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON request body." });
  }
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err.message);
  res.status(500).json({ error: "An unexpected server error occurred. Please try again." });
});

const HOST = IS_PRODUCTION ? "0.0.0.0" : "127.0.0.1";
const server = app.listen(PORT, HOST, () => {
  console.log(`SMH Collections running at http://localhost:${PORT}`);
  console.log(`Environment: ${IS_PRODUCTION ? "production" : "development"}`);
  console.log(`Database: ${path.relative(__dirname, require("./server/db").databasePath)}`);
  if (!mailConfigured()) console.log("Email: development reset links will be printed in this terminal.");
});

function shutdown(signal) {
  console.log(`\n${signal} received. Closing SMH Collections...`);
  server.close(() => {
    sessionStore.close();
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

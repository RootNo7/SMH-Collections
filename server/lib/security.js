const { randomBytes, timingSafeEqual } = require("node:crypto");

function csrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString("hex");
  }
  req.session.save((error) => {
    if (error) return next(error);
    res.setHeader("Cache-Control", "no-store");
    res.json({ csrfToken: req.session.csrfToken });
  });
}

function csrfProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const allowedOrigin = new URL(process.env.APP_ORIGIN).origin;
  const origin = req.get("origin");

  // Browser mutations must come from the configured storefront origin.
  if (!origin) {
    return res.status(403).json({ error: "Request origin is required." });
  }

  let actualOrigin;
  try {
    actualOrigin = new URL(origin).origin;
  } catch {
    return res.status(403).json({ error: "Request origin is invalid." });
  }

  if (actualOrigin !== allowedOrigin) {
    return res.status(403).json({ error: "Request origin is not allowed." });
  }

  const expected = req.session?.csrfToken;
  const supplied = req.get("x-csrf-token");
  if (typeof expected !== "string" || typeof supplied !== "string") {
    return res.status(403).json({ error: "Security token missing. Refresh and try again." });
  }

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(supplied, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(403).json({ error: "Security token invalid. Refresh and try again." });
  }
  next();
}

function requireUser(db) {
  return (req, res, next) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Please sign in to continue.", code: "AUTH_REQUIRED" });

    const user = db.prepare(`
      SELECT id, name, email, role, session_version, email_verified_at, created_at
      FROM users WHERE id = ?
    `).get(userId);

    if (!user || user.session_version !== req.session.sessionVersion) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Your session has expired. Please sign in again.", code: "AUTH_REQUIRED" });
    }

    req.user = user;
    next();
  };
}

function requireVerified(req, res, next) {
  if (!req.user?.email_verified_at) {
    return res.status(403).json({
      error: "Verify your email address before placing an order. Open the account page to send a verification link.",
      code: "EMAIL_NOT_VERIFIED"
    });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Administrator access is required." });
  }
  next();
}

module.exports = { csrfToken, csrfProtection, requireUser, requireVerified, requireAdmin };

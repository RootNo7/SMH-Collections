const express = require("express");
const rateLimit = require("express-rate-limit");
const argon2 = require("argon2");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const { db } = require("../db");
const { requireUser } = require("../lib/security");
const { string, email, normalizedEmail } = require("../lib/validation");
const { sendPasswordReset, sendVerificationEmail } = require("../lib/mailer");

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait and try again." }
});
const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many password recovery attempts. Please try later." }
});
const hashOptions = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-smh.sid" : "smh.sid";
const dummyHashPromise = argon2.hash(randomBytes(32).toString("hex"), hashOptions);

const publicUser = (user) => ({
  id: user.id, name: user.name, email: user.email, role: user.role,
  createdAt: user.created_at, emailVerified: Boolean(user.email_verified_at)
});
const findByEmail = db.prepare(`SELECT * FROM users WHERE email = ?`);
const findPublicById = db.prepare(`SELECT id, name, email, role, email_verified_at, created_at FROM users WHERE id = ?`);
const findAuthById = db.prepare(`SELECT id, name, email, role, session_version, email_verified_at, created_at FROM users WHERE id = ?`);
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");

function sendValidation(res, message) {
  return res.status(400).json({ error: message });
}
function regenerate(req) {
  return new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
}
function save(req) {
  return new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
}
async function startSession(req, userId) {
  await regenerate(req);
  const user = findAuthById.get(userId);
  req.session.userId = user.id;
  req.session.sessionVersion = user.session_version;
  req.session.csrfToken = randomBytes(32).toString("hex");
  await save(req);
}

// POST /api/auth/register
router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const { name, email: rawEmail, password } = req.body || {};
    if (!string(name, 2, 80)) return sendValidation(res, "Enter a name between 2 and 80 characters.");
    if (!email(rawEmail)) return sendValidation(res, "Enter a valid email address.");
    if (typeof password !== "string" || password.length < 12 || password.length > 128) {
      return sendValidation(res, "Use a password between 12 and 128 characters.");
    }

    const normalized = normalizedEmail(rawEmail);
    if (findByEmail.get(normalized)) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await argon2.hash(password, hashOptions);
    const userId = randomUUID();
    try {
      db.prepare(`INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)`)
        .run(userId, name.trim(), normalized, passwordHash);
    } catch (error) {
      if (String(error.code).includes("CONSTRAINT")) {
        return res.status(409).json({ error: "An account with this email already exists." });
      }
      throw error;
    }

    const verificationToken = randomBytes(32).toString("base64url");
    db.prepare(`INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`)
      .run(userId, tokenHash(verificationToken), new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
    const verificationUrl = `${process.env.APP_ORIGIN}/account.html?verify=${encodeURIComponent(verificationToken)}`;
    try {
      await sendVerificationEmail(normalized, verificationUrl);
    } catch (error) {
      // The account remains created; an authenticated customer can resend a verification link.
      console.error("Verification email delivery failed:", error.message);
    }

    await startSession(req, userId);
    res.setHeader("Cache-Control", "no-store");
    res.status(201).json({
      message: "Account created. Verify your email address before placing an order.",
      verificationRequired: true,
      user: publicUser(findPublicById.get(userId)),
      csrfToken: req.session.csrfToken
    });
  } catch (error) { next(error); }
});

// POST /api/auth/login
router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const { email: rawEmail, password } = req.body || {};
    if (!email(rawEmail) || typeof password !== "string" || !password.length || password.length > 128) {
      return res.status(400).json({ error: "Enter a valid email and password." });
    }

    const normalized = normalizedEmail(rawEmail);
    const user = findByEmail.get(normalized);
    // Perform a comparable Argon2 operation even when the email is unknown.
    const storedHash = user ? user.password_hash : await dummyHashPromise;
    const verified = await argon2.verify(storedHash, password).catch(() => false);

    if (!user || !verified) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }

    db.prepare(`UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`).run(user.id);
    await startSession(req, user.id);
    res.setHeader("Cache-Control", "no-store");
    res.json({ message: "You are signed in.", user: publicUser(findPublicById.get(user.id)), csrfToken: req.session.csrfToken });
  } catch (error) { next(error); }
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const userId = req.session?.userId;
  if (!userId) return res.json({ authenticated: false, user: null });

  const user = findAuthById.get(userId);
  if (!user || user.session_version !== req.session.sessionVersion) {
    req.session.destroy(() => {});
    return res.json({ authenticated: false, user: null });
  }
  res.json({ authenticated: true, user: publicUser(user) });
});

// POST /api/auth/verify-email. Email scanners only load the page; the token is consumed on an explicit POST.
router.post("/verify-email", authLimiter, (req, res) => {
  const token = req.body?.token;
  if (typeof token !== "string" || token.length < 30 || token.length > 200) {
    return res.status(400).json({ error: "The verification link is invalid or expired." });
  }
  const tokenRow = db.prepare(`SELECT id, user_id FROM email_verification_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`)
    .get(tokenHash(token), new Date().toISOString());
  if (!tokenRow) return res.status(400).json({ error: "The verification link is invalid or expired." });

  const verified = db.transaction(() => {
    const stillValid = db.prepare(`SELECT id FROM email_verification_tokens WHERE id = ? AND used_at IS NULL AND expires_at > ?`)
      .get(tokenRow.id, new Date().toISOString());
    if (!stillValid) return false;
    db.prepare(`UPDATE users SET email_verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(tokenRow.user_id);
    db.prepare(`UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL`)
      .run(tokenRow.user_id);
    return true;
  });
  if (!verified()) return res.status(400).json({ error: "The verification link is invalid or expired." });
  res.setHeader("Cache-Control", "no-store");
  res.json({ message: "Email verified. Your account is ready to place orders." });
});

// POST /api/auth/resend-verification
router.post("/resend-verification", authLimiter, requireUser(db), async (req, res, next) => {
  try {
    if (req.user.email_verified_at) return res.json({ message: "Your email address is already verified." });
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`DELETE FROM email_verification_tokens WHERE user_id = ? OR expires_at <= ?`).run(req.user.id, new Date().toISOString());
    db.prepare(`INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`)
      .run(req.user.id, tokenHash(token), expiresAt);
    const url = `${process.env.APP_ORIGIN}/account.html?verify=${encodeURIComponent(token)}`;
    try { await sendVerificationEmail(req.user.email, url); }
    catch (error) { console.error("Verification email delivery failed:", error.message); }
    res.setHeader("Cache-Control", "no-store");
    res.json({ message: "If email delivery is available, a fresh verification link has been sent. Check your inbox or the development server terminal." });
  } catch (error) { next(error); }
});

// PATCH /api/auth/me
router.patch("/me", requireUser(db), (req, res) => {
  const { name } = req.body || {};
  if (!string(name, 2, 80)) return sendValidation(res, "Enter a name between 2 and 80 characters.");
  db.prepare(`UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(name.trim(), req.user.id);
  res.json({ message: "Profile updated.", user: publicUser(findPublicById.get(req.user.id)) });
});

// POST /api/auth/change-password; invalidates other sessions by version increment.
router.post("/change-password", requireUser(db), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== "string" || !currentPassword.length) return sendValidation(res, "Enter your current password.");
    if (typeof newPassword !== "string" || newPassword.length < 12 || newPassword.length > 128) return sendValidation(res, "Use a new password between 12 and 128 characters.");
    if (currentPassword === newPassword) return sendValidation(res, "Choose a different new password.");

    const fullUser = findByEmail.get(req.user.email);
    const matches = await argon2.verify(fullUser.password_hash, currentPassword).catch(() => false);
    if (!matches) return res.status(400).json({ error: "Current password is incorrect." });

    const hash = await argon2.hash(newPassword, hashOptions);
    db.prepare(`UPDATE users SET password_hash = ?, session_version = session_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(hash, req.user.id);
    await startSession(req, req.user.id);
    res.json({ message: "Password changed. Other sessions have been signed out.", csrfToken: req.session.csrfToken });
  } catch (error) { next(error); }
});

// POST /api/auth/forgot-password. In development, reset links appear in the server terminal.
router.post("/forgot-password", passwordLimiter, async (req, res, next) => {
  try {
    const rawEmail = req.body?.email;
    if (!email(rawEmail)) return sendValidation(res, "Enter a valid email address.");
    const user = findByEmail.get(normalizedEmail(rawEmail));
    if (user) {
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      db.prepare(`DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at <= ?`).run(user.id, new Date().toISOString());
      db.prepare(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`)
        .run(user.id, tokenHash(token), expiresAt);
      const resetUrl = `${process.env.APP_ORIGIN}/account.html?reset=${encodeURIComponent(token)}`;
      try {
        await sendPasswordReset(user.email, resetUrl);
      } catch (error) {
        db.prepare(`DELETE FROM password_reset_tokens WHERE token_hash = ?`).run(tokenHash(token));
        // Keep the public response generic to avoid account enumeration.
        console.error("Password reset email delivery failed:", error.message);
      }
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ message: "If that email belongs to an account, a password reset link has been sent." });
  } catch (error) { next(error); }
});

// POST /api/auth/reset-password
router.post("/reset-password", passwordLimiter, async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (typeof token !== "string" || token.length < 30 || token.length > 200) return sendValidation(res, "The reset link is invalid or expired.");
    if (typeof password !== "string" || password.length < 12 || password.length > 128) return sendValidation(res, "Use a password between 12 and 128 characters.");

    const found = db.prepare(`
      SELECT id, user_id FROM password_reset_tokens
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
    `).get(tokenHash(token), new Date().toISOString());
    if (!found) return res.status(400).json({ error: "The reset link is invalid or expired." });

    const passwordHash = await argon2.hash(password, hashOptions);
    const complete = db.transaction(() => {
      const check = db.prepare(`SELECT id FROM password_reset_tokens WHERE id = ? AND used_at IS NULL AND expires_at > ?`)
        .get(found.id, new Date().toISOString());
      if (!check) return false;
      db.prepare(`UPDATE users SET password_hash = ?, session_version = session_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(passwordHash, found.user_id);
      db.prepare(`UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL`)
        .run(found.user_id);
      return true;
    });
    if (!complete()) return res.status(400).json({ error: "The reset link is invalid or expired." });
    res.json({ message: "Password reset complete. You can now sign in." });
  } catch (error) { next(error); }
});

// POST /api/auth/logout
router.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    const secure = process.env.NODE_ENV === "production";
    res.clearCookie(COOKIE_NAME, { httpOnly: true, secure, sameSite: "lax", path: "/" });
    res.setHeader("Cache-Control", "no-store");
    res.json({ message: "You have signed out." });
  });
});

module.exports = router;

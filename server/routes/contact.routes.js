const express = require("express");
const rateLimit = require("express-rate-limit");
const { db } = require("../db");
const { string, email, normalizedEmail } = require("../lib/validation");

const router = express.Router();
const messageLimit = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 8,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many submissions. Please try again later." }
});

router.post("/contact", messageLimit, (req, res) => {
  const { name, email: address, subject, message } = req.body || {};
  if (!string(name, 2, 80)) return res.status(400).json({ error: "Enter your name (2–80 characters)." });
  if (!email(address)) return res.status(400).json({ error: "Enter a valid email address." });
  if (!string(subject, 3, 120)) return res.status(400).json({ error: "Subject must be 3–120 characters." });
  if (!string(message, 10, 4000)) return res.status(400).json({ error: "Message must be 10–4,000 characters." });
  db.prepare(`INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)`)
    .run(name.trim(), normalizedEmail(address), subject.trim(), message.trim());
  res.status(201).json({ message: "Your message has been received. Thank you for contacting SMH Collections." });
});

router.post("/newsletter", messageLimit, (req, res) => {
  const address = req.body?.email;
  if (!email(address)) return res.status(400).json({ error: "Enter a valid email address." });
  db.prepare(`INSERT OR IGNORE INTO newsletter_subscribers (email) VALUES (?)`).run(normalizedEmail(address));
  res.status(201).json({ message: "Thanks for joining the SMH Collections mailing list." });
});

module.exports = router;

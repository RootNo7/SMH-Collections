const nodemailer = require("nodemailer");

let transporter = null;
function configured() {
  return Boolean(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS && process.env.MAIL_FROM);
}

function getTransporter() {
  if (!configured()) return null;
  if (!transporter) {
    const secure = String(process.env.MAIL_SECURE).toLowerCase() === "true";
    transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT || 587),
      secure,
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }
  return transporter;
}

async function sendPasswordReset(to, url) {
  const transport = getTransporter();
  if (!transport) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email delivery is not configured for password recovery.");
    }
    console.log(`\n[DEV PASSWORD RESET] For ${to}: ${url}\n`);
    return;
  }
  await transport.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: "Reset your SMH Collections password",
    text: `A password reset was requested for your SMH Collections account. Use this link within 30 minutes:\n\n${url}\n\nIf you did not request this, ignore this email.`,
    html: `<p>A password reset was requested for your SMH Collections account.</p><p><a href="${url}">Reset your password</a></p><p>This link expires in 30 minutes. If you did not request this, ignore this email.</p>`
  });
}


async function sendVerificationEmail(to, url) {
  const transport = getTransporter();
  if (!transport) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email delivery is not configured for email verification.");
    }
    console.log(`\n[DEV EMAIL VERIFICATION] For ${to}: ${url}\n`);
    return;
  }
  await transport.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: "Verify your SMH Collections email",
    text: `Confirm your email address for SMH Collections using this link within 24 hours:\n\n${url}\n\nIf you did not create this account, ignore this email.`,
    html: `<p>Confirm your email address for SMH Collections.</p><p><a href="${url}">Verify email address</a></p><p>This link expires in 24 hours. If you did not create this account, ignore this email.</p>`
  });
}

module.exports = { configured, sendPasswordReset, sendVerificationEmail };

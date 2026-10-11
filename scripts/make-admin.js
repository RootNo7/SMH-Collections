require("dotenv").config();
const { db } = require("../server/db");

const email = String(process.argv[2] || "").trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run admin:create -- customer@example.com");
  console.error("The user must create an account before being promoted.");
  process.exit(1);
}
const result = db.prepare(`UPDATE users SET role = 'admin', updated_at = CURRENT_TIMESTAMP WHERE email = ?`).run(email);
if (!result.changes) {
  console.error("No account found for that email. Create the account first, then run this command again.");
  process.exit(1);
}
console.log(`Admin privileges granted to ${email}. Keep this account secure.`);
db.close();

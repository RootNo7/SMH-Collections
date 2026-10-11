const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");

test("main storefront and backend modules are present", () => {
  const required = [
    "server.js", "package.json", ".env.example", "server/db.js", "server/seed.js",
    "server/routes/auth.routes.js", "server/routes/store.routes.js",
    "server/routes/admin.routes.js", "server/routes/contact.routes.js",
    "server/lib/security.js", "server/lib/sqlite-session-store.js",
    "public/index.html", "public/shop.html", "public/product.html", "public/cart.html",
    "public/checkout.html", "public/account.html", "public/admin.html", "public/css/style.css",
    "public/js/api.js", "public/js/app.js", "public/images/placeholder.svg"
  ];
  for (const relative of required) {
    assert.equal(fs.existsSync(path.join(root, relative)), true, `Missing ${relative}`);
  }
});

test("all HTML pages have a doctype and viewport declaration", () => {
  const files = fs.readdirSync(path.join(root, "public")).filter((f) => f.endsWith(".html"));
  assert.ok(files.length >= 15, `Expected at least 15 pages, found ${files.length}`);
  for (const file of files) {
    const html = fs.readFileSync(path.join(root, "public", file), "utf8");
    assert.match(html, /^<!doctype html>/i, `${file} has no HTML5 doctype`);
    assert.match(html, /name="viewport"/i, `${file} is missing a responsive viewport`);
  }
});

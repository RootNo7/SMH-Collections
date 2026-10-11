const test = require("node:test");
const assert = require("node:assert/strict");
const { string, email, integer, safeSlug, imageUrl, normalizedEmail } = require("../server/lib/validation");

test("string validator trims and enforces length", () => {
  assert.equal(string("  SMH  ", 2, 10), true);
  assert.equal(string("  ", 1, 10), false);
  assert.equal(string("a long product description", 2, 5), false);
  assert.equal(string(42, 1, 20), false);
});

test("email validator rejects malformed and oversized values", () => {
  assert.equal(email("customer@example.com"), true);
  assert.equal(email("no-at-symbol.example.com"), false);
  assert.equal(email("one@two"), false);
  assert.equal(email("x".repeat(255) + "@example.com"), false);
});

test("integer validator requires an integer inside bounds", () => {
  assert.equal(integer(5, 1, 10), true);
  assert.equal(integer(1.5, 1, 10), false);
  assert.equal(integer(11, 1, 10), false);
  assert.equal(integer("5", 1, 10), false);
});

test("slug validator only accepts lowercase URL-safe product IDs", () => {
  assert.equal(safeSlug("linen-everyday-shirt"), true);
  assert.equal(safeSlug("product1"), true);
  assert.equal(safeSlug("Uppercase-Name"), false);
  assert.equal(safeSlug("a--b"), false);
  assert.equal(safeSlug("../server"), false);
});

test("product image URLs are HTTPS and host allow-listed", () => {
  assert.equal(imageUrl("https://images.unsplash.com/photo-123"), true);
  assert.equal(imageUrl("https://images.pexels.com/photos/123/photo.jpg"), true);
  assert.equal(imageUrl("http://images.unsplash.com/photo-123"), false);
  assert.equal(imageUrl("https://example.com/image.jpg"), false);
  assert.equal(imageUrl("javascript:alert(1)"), false);
});

test("email normalization trims whitespace and lowercases", () => {
  assert.equal(normalizedEmail("  CUSTOMER@Example.COM "), "customer@example.com");
});

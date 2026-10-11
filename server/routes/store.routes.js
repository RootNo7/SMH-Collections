const express = require("express");
const { randomBytes } = require("node:crypto");
const { db } = require("../db");
const { requireUser, requireVerified } = require("../lib/security");
const { string, email, integer, safeSlug, normalizedEmail } = require("../lib/validation");

const router = express.Router();
const userRequired = requireUser(db);
const SHIPPING_FEE = 250;
const FREE_SHIPPING_THRESHOLD = 5000;

const productFields = `id, name, category, description, price, stock, image_url AS image, featured`;
function cartFor(userId) {
  const rows = db.prepare(`
    SELECT p.id, p.name, p.category, p.price, p.image_url AS image, p.stock, p.active, c.quantity,
           (p.price * c.quantity) AS lineTotal
    FROM cart_items c JOIN products p ON p.id = c.product_id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `).all(userId);
  const items = rows.map((item) => ({ ...item, active: Boolean(item.active), available: Boolean(item.active) && item.stock >= item.quantity && item.stock > 0 }));
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const shipping = items.length ? (subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE) : 0;
  return { items, subtotal, shipping, total: subtotal + shipping, freeShippingThreshold: FREE_SHIPPING_THRESHOLD };
}

function publicProduct(row) {
  if (!row) return null;
  return { ...row, featured: Boolean(row.featured), inStock: row.stock > 0 };
}

// Public catalogue. Limits and sort expressions are allow-listed.
router.get("/products", (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 100);
  const category = String(req.query.category || "").trim().slice(0, 60);
  const sort = String(req.query.sort || "featured");
  const limit = Math.max(1, Math.min(60, Number.parseInt(req.query.limit || "48", 10) || 48));
  const allowedSort = {
    featured: "featured DESC, created_at DESC",
    price_asc: "price ASC, name ASC",
    price_desc: "price DESC, name ASC",
    name: "name COLLATE NOCASE ASC",
    newest: "created_at DESC"
  };
  const where = ["active = 1"];
  const params = [];
  if (q) {
    where.push("(name LIKE ? OR description LIKE ? OR category LIKE ?)");
    const term = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    params.push(term, term, term);
  }
  if (category && category.toLowerCase() !== "all") {
    where.push("category = ?");
    params.push(category);
  }
  const whereSql = where.join(" AND ");
  const products = db.prepare(`SELECT ${productFields} FROM products WHERE ${whereSql} ORDER BY ${allowedSort[sort] || allowedSort.featured} LIMIT ?`)
    .all(...params, limit).map(publicProduct);
  const total = db.prepare(`SELECT COUNT(*) AS count FROM products WHERE ${whereSql}`).get(...params).count;
  const categories = db.prepare(`SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category`).all().map((r) => r.category);
  res.setHeader("Cache-Control", "no-store");
  res.json({ products, total, categories });
});

router.get("/products/:id", (req, res) => {
  if (!safeSlug(req.params.id)) return res.status(400).json({ error: "Invalid product identifier." });
  const product = db.prepare(`SELECT ${productFields} FROM products WHERE id = ? AND active = 1`).get(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found." });
  const related = db.prepare(`SELECT ${productFields} FROM products WHERE active = 1 AND category = ? AND id != ? ORDER BY featured DESC, name LIMIT 4`)
    .all(product.category, product.id).map(publicProduct);
  res.json({ product: publicProduct(product), related });
});

// Server-backed carts are used for authenticated accounts. The frontend provides a guest cart as well.
router.get("/cart", userRequired, (req, res) => res.json(cartFor(req.user.id)));

router.post("/cart/items", userRequired, (req, res) => {
  const { productId, quantity } = req.body || {};
  if (!safeSlug(productId) || !integer(quantity, 1, 10)) {
    return res.status(400).json({ error: "Choose a valid product and quantity between 1 and 10." });
  }
  const product = db.prepare(`SELECT id, stock, active FROM products WHERE id = ?`).get(productId);
  if (!product || !product.active) return res.status(404).json({ error: "Product is no longer available." });
  const existing = db.prepare(`SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?`).get(req.user.id, productId);
  const nextQuantity = (existing?.quantity || 0) + quantity;
  if (product.stock < 1) return res.status(409).json({ error: "This item is out of stock." });
  if (nextQuantity > product.stock || nextQuantity > 10) {
    return res.status(409).json({ error: `Only ${Math.min(product.stock, 10)} item(s) can be held in your cart.` });
  }
  db.prepare(`
    INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
    ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = excluded.quantity, updated_at = CURRENT_TIMESTAMP
  `).run(req.user.id, productId, nextQuantity);
  res.json(cartFor(req.user.id));
});

router.patch("/cart/items/:productId", userRequired, (req, res) => {
  const id = req.params.productId;
  const { quantity } = req.body || {};
  if (!safeSlug(id) || !integer(quantity, 1, 10)) return res.status(400).json({ error: "Quantity must be between 1 and 10." });
  const product = db.prepare(`SELECT stock, active FROM products WHERE id = ?`).get(id);
  if (!product || !product.active) return res.status(404).json({ error: "Product is no longer available." });
  if (quantity > product.stock) return res.status(409).json({ error: `Only ${product.stock} item(s) are available.` });
  const result = db.prepare(`UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND product_id = ?`)
    .run(quantity, req.user.id, id);
  if (!result.changes) return res.status(404).json({ error: "Cart item not found." });
  res.json(cartFor(req.user.id));
});

router.delete("/cart/items/:productId", userRequired, (req, res) => {
  if (!safeSlug(req.params.productId)) return res.status(400).json({ error: "Invalid product identifier." });
  db.prepare(`DELETE FROM cart_items WHERE user_id = ? AND product_id = ?`).run(req.user.id, req.params.productId);
  res.json(cartFor(req.user.id));
});

router.delete("/cart", userRequired, (req, res) => {
  db.prepare(`DELETE FROM cart_items WHERE user_id = ?`).run(req.user.id);
  res.json(cartFor(req.user.id));
});

// Wishlist
router.get("/wishlist", userRequired, (req, res) => {
  const products = db.prepare(`
    SELECT p.id, p.name, p.category, p.description, p.price,
      p.stock, p.image_url AS image, p.featured
    FROM wishlist_items w JOIN products p ON p.id = w.product_id
    WHERE w.user_id = ? AND p.active = 1 ORDER BY w.created_at DESC
  `).all(req.user.id).map(publicProduct);
  res.json({ products });
});

router.post("/wishlist/:productId", userRequired, (req, res) => {
  const id = req.params.productId;
  if (!safeSlug(id)) return res.status(400).json({ error: "Invalid product identifier." });
  const product = db.prepare(`SELECT id FROM products WHERE id = ? AND active = 1`).get(id);
  if (!product) return res.status(404).json({ error: "Product not found." });
  db.prepare(`INSERT OR IGNORE INTO wishlist_items (user_id, product_id) VALUES (?, ?)`).run(req.user.id, id);
  res.json({ success: true });
});

router.delete("/wishlist/:productId", userRequired, (req, res) => {
  if (!safeSlug(req.params.productId)) return res.status(400).json({ error: "Invalid product identifier." });
  db.prepare(`DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?`).run(req.user.id, req.params.productId);
  res.json({ success: true });
});

// Order creation always recomputes price, stock, subtotal and shipping on the server.
router.post("/orders", userRequired, requireVerified, (req, res) => {
  const body = req.body || {};
  const required = [
    ["shippingName", "Enter the recipient's name.", 2, 100],
    ["email", "Enter a valid email address.", 3, 254],
    ["phone", "Enter a phone number between 7 and 24 characters.", 7, 24],
    ["addressLine1", "Enter your street address.", 4, 180],
    ["city", "Enter your city.", 2, 80],
    ["postalCode", "Enter your postal code.", 2, 20]
  ];
  for (const [key, error, min, max] of required) {
    if (!string(body[key], min, max)) return res.status(400).json({ error });
  }
  if (!email(body.email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (body.addressLine2 != null && !string(body.addressLine2, 0, 180)) return res.status(400).json({ error: "Address line 2 is too long." });
  if (body.notes != null && !string(body.notes, 0, 500)) return res.status(400).json({ error: "Order notes must be under 500 characters." });
  if (body.paymentMethod && body.paymentMethod !== "cod") return res.status(400).json({ error: "Only cash on delivery is currently available." });

  const orderId = `SMH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const created = db.transaction(() => {
    const items = db.prepare(`
      SELECT p.id, p.name, p.price, p.stock, p.active, p.image_url AS image, c.quantity
      FROM cart_items c JOIN products p ON p.id = c.product_id WHERE c.user_id = ?
    `).all(req.user.id);
    if (!items.length) return { error: "Your cart is empty." };

    for (const item of items) {
      if (!item.active) return { error: `${item.name} is no longer available.` };
      if (item.quantity > item.stock) return { error: `Only ${item.stock} of ${item.name} are available.` };
    }

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const total = subtotal + shipping;
    db.prepare(`
      INSERT INTO orders (
        id, user_id, status, payment_method, subtotal, shipping, total,
        shipping_name, email, phone, address_line1, address_line2, city, postal_code, notes
      ) VALUES (?, ?, 'pending', 'cod', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId, req.user.id, subtotal, shipping, total,
      body.shippingName.trim(), normalizedEmail(body.email), body.phone.trim(),
      body.addressLine1.trim(), String(body.addressLine2 || "").trim() || null,
      body.city.trim(), body.postalCode.trim(), String(body.notes || "").trim() || null
    );

    const addItem = db.prepare(`INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, image_url) VALUES (?, ?, ?, ?, ?, ?)`);
    const stockUpdate = db.prepare(`UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ?`);
    for (const item of items) {
      addItem.run(orderId, item.id, item.name, item.price, item.quantity, item.image);
      const changed = stockUpdate.run(item.quantity, item.id, item.quantity);
      if (changed.changes !== 1) throw new Error("Inventory changed while creating this order. Please retry.");
    }
    db.prepare(`DELETE FROM cart_items WHERE user_id = ?`).run(req.user.id);
    return { order: { id: orderId, status: "pending", subtotal, shipping, total, paymentMethod: "cod" } };
  });

  try {
    const result = created();
    if (result.error) return res.status(409).json({ error: result.error });
    res.status(201).json({ message: "Order placed successfully.", order: result.order });
  } catch (error) {
    if (error.message.includes("Inventory changed")) return res.status(409).json({ error: error.message });
    throw error;
  }
});

router.get("/orders", userRequired, (req, res) => {
  const orders = db.prepare(`
    SELECT id, status, payment_method AS paymentMethod, subtotal, shipping, total,
      shipping_name AS shippingName, created_at AS createdAt
    FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(req.user.id);
  res.json({ orders });
});

router.get("/orders/:id", userRequired, (req, res) => {
  const order = db.prepare(`
    SELECT id, status, payment_method AS paymentMethod, subtotal, shipping, total,
      shipping_name AS shippingName, email, phone, address_line1 AS addressLine1,
      address_line2 AS addressLine2, city, postal_code AS postalCode, notes,
      created_at AS createdAt, updated_at AS updatedAt
    FROM orders WHERE id = ? AND user_id = ?
  `).get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: "Order not found." });
  order.items = db.prepare(`SELECT product_name AS name, unit_price AS price, quantity, image_url AS image FROM order_items WHERE order_id = ?`).all(order.id);
  res.json({ order });
});

module.exports = router;

const express = require("express");
const { db } = require("../db");
const { requireUser, requireVerified, requireAdmin } = require("../lib/security");
const { string, integer, safeSlug, imageUrl, email } = require("../lib/validation");

const router = express.Router();
router.use(requireUser(db), requireVerified, requireAdmin);

function productFrom(row) {
  return row ? { ...row, featured: Boolean(row.featured), active: Boolean(row.active) } : null;
}

router.get("/summary", (req, res) => {
  const users = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'customer'`).get().n;
  const products = db.prepare(`SELECT COUNT(*) AS n FROM products WHERE active = 1`).get().n;
  const orders = db.prepare(`SELECT COUNT(*) AS n FROM orders`).get().n;
  const grossSales = db.prepare(`SELECT COALESCE(SUM(total), 0) AS n FROM orders WHERE status != 'cancelled'`).get().n;
  res.json({ users, products, orders, grossSales });
});

router.get("/orders", (req, res) => {
  const status = String(req.query.status || "").trim();
  const allowed = new Set(["pending", "confirmed", "shipped", "delivered", "cancelled"]);
  const rows = status && allowed.has(status)
    ? db.prepare(`SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 250`).all(status)
    : db.prepare(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 250`).all();
  res.json({ orders: rows });
});

router.patch("/orders/:id/status", (req, res) => {
  const nextStatus = req.body?.status;
  const order = db.prepare(`SELECT id, status FROM orders WHERE id = ?`).get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });
  const allowedTransitions = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["shipped", "cancelled"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: []
  };
  if (!allowedTransitions[order.status]?.includes(nextStatus)) {
    return res.status(409).json({ error: `Order cannot move from ${order.status} to ${String(nextStatus)}.` });
  }

  const update = db.transaction(() => {
    if (nextStatus === "cancelled") {
      const items = db.prepare(`SELECT product_id, quantity FROM order_items WHERE order_id = ?`).all(order.id);
      const restock = db.prepare(`UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
      for (const item of items) {
        if (item.product_id) restock.run(item.quantity, item.product_id);
      }
    }
    db.prepare(`UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(nextStatus, order.id);
  });
  update();
  res.json({ message: "Order status updated.", id: order.id, status: nextStatus });
});

router.get("/products", (req, res) => {
  const products = db.prepare(`SELECT id, name, category, description, price, stock, image_url AS image, featured, active, created_at AS createdAt FROM products ORDER BY created_at DESC`).all().map(productFrom);
  res.json({ products });
});

function validateProduct(body, existing = {}) {
  const value = {
    id: body.id ?? existing.id,
    name: body.name ?? existing.name,
    category: body.category ?? existing.category,
    description: body.description ?? existing.description,
    price: body.price ?? existing.price,
    stock: body.stock ?? existing.stock,
    image_url: body.image ?? body.image_url ?? existing.image_url,
    featured: body.featured ?? existing.featured ?? false,
    active: body.active ?? existing.active ?? true
  };
  if (!safeSlug(value.id)) return { error: "Product ID must be a lowercase slug, e.g. cotton-weekend-shirt." };
  if (!string(value.name, 2, 100)) return { error: "Product name must be 2–100 characters." };
  if (!string(value.category, 2, 40)) return { error: "Category must be 2–40 characters." };
  if (!string(value.description, 5, 1200)) return { error: "Description must be 5–1,200 characters." };
  if (!integer(Number(value.price), 100, 1000000)) return { error: "Price must be between Rs. 100 and Rs. 1,000,000." };
  if (!integer(Number(value.stock), 0, 100000)) return { error: "Stock must be between 0 and 100,000." };
  if (!imageUrl(value.image_url)) return { error: "Image URL must be HTTPS on images.unsplash.com or images.pexels.com." };
  if (![true, false, 0, 1].includes(value.featured) || ![true, false, 0, 1].includes(value.active)) {
    return { error: "Featured and active must be true or false." };
  }
  return {
    value: {
      ...value,
      name: value.name.trim(), category: value.category.trim(), description: value.description.trim(),
      price: Number(value.price), stock: Number(value.stock),
      featured: value.featured === true || value.featured === 1 ? 1 : 0,
      active: value.active === true || value.active === 1 ? 1 : 0
    }
  };
}

router.post("/products", (req, res) => {
  const checked = validateProduct(req.body || {});
  if (checked.error) return res.status(400).json({ error: checked.error });
  const p = checked.value;
  try {
    db.prepare(`INSERT INTO products (id, name, category, description, price, stock, image_url, featured, active) VALUES (@id, @name, @category, @description, @price, @stock, @image_url, @featured, @active)`).run(p);
  } catch (error) {
    if (String(error.code).includes("CONSTRAINT")) return res.status(409).json({ error: "A product with that ID already exists." });
    throw error;
  }
  res.status(201).json({ message: "Product created.", product: productFrom(db.prepare(`SELECT * FROM products WHERE id = ?`).get(p.id)) });
});

router.patch("/products/:id", (req, res) => {
  if (!safeSlug(req.params.id)) return res.status(400).json({ error: "Invalid product ID." });
  const current = db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id);
  if (!current) return res.status(404).json({ error: "Product not found." });
  const checked = validateProduct({ ...req.body, id: current.id }, current);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const p = checked.value;
  db.prepare(`UPDATE products SET name=@name, category=@category, description=@description, price=@price, stock=@stock, image_url=@image_url, featured=@featured, active=@active, updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run(p);
  res.json({ message: "Product updated.", product: productFrom(db.prepare(`SELECT * FROM products WHERE id = ?`).get(p.id)) });
});


router.get("/contact", (req, res) => {
  const messages = db.prepare(`SELECT id, name, email, subject, message, created_at AS createdAt FROM contact_messages ORDER BY created_at DESC LIMIT 250`).all();
  res.json({ messages });
});

router.get("/newsletter", (req, res) => {
  const subscribers = db.prepare(`SELECT email, created_at AS createdAt FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 1000`).all();
  res.json({ subscribers });
});

router.get("/customers", (req, res) => {
  const users = db.prepare(`SELECT id, name, email, created_at AS createdAt, last_login_at AS lastLoginAt FROM users WHERE role = 'customer' ORDER BY created_at DESC LIMIT 250`).all();
  res.json({ users });
});

module.exports = router;

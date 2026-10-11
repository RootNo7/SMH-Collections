(() => {
  "use strict";
  const API = "/api";
  const CART_KEY = "smh.guestCart.v1";
  const WISHLIST_KEY = "smh.guestWishlist.v1";
  let csrfToken = "";

  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.data = data;
    }
  }

  function safeRead(key, fallback) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || "null");
      return data ?? fallback;
    } catch {
      return fallback;
    }
  }
  function safeWrite(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
  function readGuestCart() {
    const value = safeRead(CART_KEY, []);
    return Array.isArray(value) ? value.filter((i) => i && typeof i.id === "string" && Number.isInteger(i.quantity) && i.quantity > 0).slice(0, 100) : [];
  }
  function writeGuestCart(items) { safeWrite(CART_KEY, items); }
  function readGuestWishlist() {
    const value = safeRead(WISHLIST_KEY, []);
    return Array.isArray(value) ? [...new Set(value.filter((id) => typeof id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)))] : [];
  }
  function writeGuestWishlist(items) { safeWrite(WISHLIST_KEY, [...new Set(items)]); }

  async function getCsrfToken() {
    const response = await fetch(`${API}/security/csrf`, {
      method: "GET", credentials: "same-origin", cache: "no-store",
      headers: { Accept: "application/json" }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.csrfToken) throw new ApiError(data.error || "Security initialization failed.", response.status, data);
    csrfToken = data.csrfToken;
    return csrfToken;
  }

  async function request(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      if (!csrfToken) await getCsrfToken();
      headers.set("X-CSRF-Token", csrfToken);
    }
    let response;
    try {
      response = await fetch(`${API}${path}`, {
        ...options, method, headers, credentials: "same-origin", cache: "no-store"
      });
    } catch {
      throw new ApiError("Could not connect to the SMH server. Make sure it is running.", 0, {});
    }
    const data = await response.json().catch(() => ({}));
    if (data.csrfToken) csrfToken = data.csrfToken;
    if (!response.ok) throw new ApiError(data.error || "The request could not be completed.", response.status, data);
    return data;
  }

  const money = (amount) => new Intl.NumberFormat("en-PK", {
    style: "currency", currency: "PKR", maximumFractionDigits: 0
  }).format(Number(amount) || 0);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function toast(message, kind = "info") {
    let node = document.querySelector(".toast");
    if (!node) {
      node = document.createElement("div");
      node.className = "toast";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.dataset.kind = kind;
    clearTimeout(node._timeout);
    node._timeout = setTimeout(() => node.remove(), 3200);
  }

  function guestCartResult(sourceItems = readGuestCart()) {
    const items = sourceItems.map((item) => ({
      ...item,
      available: item.active !== false && Number(item.stock) >= item.quantity && Number(item.stock) > 0,
      lineTotal: item.price * item.quantity
    }));
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const shipping = items.length ? (subtotal >= 5000 ? 0 : 250) : 0;
    return { items, subtotal, shipping, total: subtotal + shipping, freeShippingThreshold: 5000, guest: true };
  }

  async function getCart() {
    try { return await request("/cart"); }
    catch (error) {
      if (error.status !== 401) throw error;
      const items = readGuestCart();
      for (const item of items) {
        try {
          const { product } = await request(`/products/${encodeURIComponent(item.id)}`);
          Object.assign(item, { name: product.name, category: product.category, price: product.price, image: product.image, stock: product.stock, active: true });
        } catch {
          item.active = false;
          item.stock = 0;
        }
      }
      writeGuestCart(items);
      return guestCartResult(items);
    }
  }

  async function addToCart(product, quantity = 1) {
    try {
      return await request("/cart/items", {
        method: "POST", body: JSON.stringify({ productId: product.id, quantity })
      });
    } catch (error) {
      if (error.status !== 401) throw error;
      const items = readGuestCart();
      const existing = items.find((item) => item.id === product.id);
      const next = (existing?.quantity || 0) + quantity;
      const availableStock = Number.isFinite(Number(product.stock)) ? Number(product.stock) : 10;
      if (availableStock < 1 || next > Math.min(availableStock, 10)) throw new Error(`Only ${Math.max(0, Math.min(availableStock, 10))} item(s) are available.`);
      if (existing) existing.quantity = next;
      else items.push({ id: product.id, name: product.name, category: product.category, price: product.price, image: product.image, stock: product.stock, quantity });
      writeGuestCart(items);
      return guestCartResult();
    }
  }

  async function updateCartItem(id, quantity) {
    try { return await request(`/cart/items/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ quantity }) }); }
    catch (error) {
      if (error.status !== 401) throw error;
      const items = readGuestCart();
      const found = items.find((item) => item.id === id);
      if (!found) throw new Error("Cart item not found.");
      found.quantity = quantity;
      writeGuestCart(items);
      return guestCartResult();
    }
  }

  async function removeCartItem(id) {
    try { return await request(`/cart/items/${encodeURIComponent(id)}`, { method: "DELETE" }); }
    catch (error) {
      if (error.status !== 401) throw error;
      writeGuestCart(readGuestCart().filter((item) => item.id !== id));
      return guestCartResult();
    }
  }

  async function clearCart() {
    try { return await request("/cart", { method: "DELETE" }); }
    catch (error) {
      if (error.status !== 401) throw error;
      writeGuestCart([]);
      return guestCartResult();
    }
  }

  async function getWishlist() {
    try { return (await request("/wishlist")).products; }
    catch (error) {
      if (error.status !== 401) throw error;
      const ids = readGuestWishlist();
      const products = await Promise.all(ids.map(async (id) => {
        try { return (await request(`/products/${encodeURIComponent(id)}`)).product; }
        catch { return null; }
      }));
      return products.filter(Boolean);
    }
  }

  async function toggleWishlist(product) {
    try {
      const current = (await request("/wishlist")).products;
      const exists = current.some((item) => item.id === product.id);
      if (exists) await request(`/wishlist/${encodeURIComponent(product.id)}`, { method: "DELETE" });
      else await request(`/wishlist/${encodeURIComponent(product.id)}`, { method: "POST", body: JSON.stringify({}) });
      return !exists;
    } catch (error) {
      if (error.status !== 401) throw error;
      const ids = readGuestWishlist();
      const exists = ids.includes(product.id);
      writeGuestWishlist(exists ? ids.filter((id) => id !== product.id) : [...ids, product.id]);
      return !exists;
    }
  }

  async function wishlistIds() {
    try { return (await request("/wishlist")).products.map((p) => p.id); }
    catch (error) { if (error.status === 401) return readGuestWishlist(); throw error; }
  }

  async function syncGuestData() {
    const guestCart = readGuestCart();
    const guestWishlist = readGuestWishlist();
    const remainingCart = [];
    const remainingWishlist = [];
    for (const item of guestCart) {
      try { await request("/cart/items", { method: "POST", body: JSON.stringify({ productId: item.id, quantity: item.quantity }) }); }
      catch (error) { remainingCart.push(item); toast(error.message || `Could not merge ${item.name}.`, "error"); }
    }
    for (const id of guestWishlist) {
      try { await request(`/wishlist/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify({}) }); }
      catch { remainingWishlist.push(id); }
    }
    writeGuestCart(remainingCart);
    writeGuestWishlist(remainingWishlist);
  }

  window.SMH = {
    request, money, escapeHtml, toast, getCsrfToken,
    getCart, addToCart, updateCartItem, removeCartItem, clearCart,
    getWishlist, toggleWishlist, wishlistIds, syncGuestData,
    guestCartResult
  };
})();

(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const esc = window.SMH.escapeHtml;
  const statusLabels = { pending: "Pending", confirmed: "Confirmed", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };

  function showMessage(text, error = false) {
    const el = $("#admin-message");
    if (!el) return;
    el.textContent = text;
    el.className = `alert ${error ? 'alert-error' : 'alert-success'}`;
    el.hidden = !text;
  }

  async function loadSummary() {
    const result = await window.SMH.request("/admin/summary");
    const map = { customers: result.users, products: result.products, orders: result.orders, revenue: window.SMH.money(result.grossSales) };
    Object.entries(map).forEach(([key, value]) => {
      const el = document.querySelector(`[data-stat="${key}"]`);
      if (el) el.textContent = String(value);
    });
  }

  async function loadProducts() {
    const host = $("#admin-products-table");
    const { products } = await window.SMH.request("/admin/products");
    host.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Action</th></tr></thead><tbody>${products.map((p) => `
      <tr><td><strong>${esc(p.name)}</strong><br><small>${esc(p.id)}</small></td><td>${esc(p.category)}</td><td>${window.SMH.money(p.price)}</td><td>${p.stock}</td><td>${p.active ? 'Active' : 'Hidden'}</td><td><button class="btn btn-small btn-secondary" type="button" data-edit-product="${esc(p.id)}">Edit</button></td></tr>`).join("")}</tbody></table></div>`;
    host._products = products;
  }

  async function loadOrders() {
    const host = $("#admin-orders-table");
    const { orders } = await window.SMH.request("/admin/orders");
    host.innerHTML = orders.length ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Update</th></tr></thead><tbody>${orders.map((order) => `
      <tr><td><strong>${esc(order.id)}</strong><br><small>${esc(order.created_at)}</small></td><td>${esc(order.shipping_name)}<br><small>${esc(order.email)}</small></td><td>${window.SMH.money(order.total)}</td><td><span class="status ${esc(order.status)}">${esc(statusLabels[order.status] || order.status)}</span></td><td><div class="cluster"><select aria-label="New order status" data-status-for="${esc(order.id)}"><option value="">Choose…</option>${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select><button class="btn btn-small" type="button" data-save-status="${esc(order.id)}">Save</button></div></td></tr>`).join("")}</tbody></table></div>` : '<p class="muted">No orders have been placed yet.</p>';
  }

  async function loadContactMessages() {
    const host = $("#admin-contact-messages");
    if (!host) return;
    const { messages } = await window.SMH.request("/admin/contact");
    host.innerHTML = messages.length ? `<div class="stack">${messages.map((item) => `
      <article class="card"><div class="order-card-top"><div><h3>${esc(item.subject)}</h3><p>${esc(item.name)} · ${esc(item.email)}</p></div><small>${esc(item.createdAt)}</small></div><p style="white-space:pre-wrap">${esc(item.message)}</p></article>`).join("")}</div>` : '<p class="muted">No contact messages yet.</p>';
  }

  async function loadNewsletter() {
    const host = $("#admin-newsletter-list");
    if (!host) return;
    const { subscribers } = await window.SMH.request("/admin/newsletter");
    host.innerHTML = subscribers.length ? `<div class="table-wrap"><table><thead><tr><th>Email</th><th>Subscribed</th></tr></thead><tbody>${subscribers.map((item) => `<tr><td>${esc(item.email)}</td><td>${esc(item.createdAt)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="muted">No subscribers yet.</p>';
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!$("#admin-page")) return;
    try {
      const state = await window.SMH.request("/auth/me");
      if (!state.authenticated || state.user.role !== "admin" || !state.user.emailVerified) {
        $("#admin-content").hidden = true;
        showMessage(!state.authenticated ? "Sign in with the administrator account." : (!state.user.emailVerified ? "Verify the administrator account email before using admin tools." : "Administrator access is required."), true);
        const link = $("#admin-signin-link");
        if (link) link.hidden = false;
        return;
      }
      document.body.dataset.adminAuthorized = "true";
      await Promise.all([loadSummary(), loadProducts(), loadOrders(), loadContactMessages(), loadNewsletter()]);
    } catch (error) { showMessage(error.message, true); }

    const productForm = $("#admin-product-form");
    productForm?.addEventListener("reset", () => setTimeout(() => { $("#admin-product-form-title").textContent = "Add a product"; }, 0));
    productForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = productForm.querySelector("button[type=submit]");
      button.disabled = true;
      const data = new FormData(productForm);
      const payload = {
        id: data.get("id"), name: data.get("name"), category: data.get("category"),
        description: data.get("description"), price: Number(data.get("price")),
        stock: Number(data.get("stock")), image: data.get("image"),
        featured: data.get("featured") === "on", active: data.get("active") === "on"
      };
      try {
        const existing = payload.id && $("#admin-products-table")._products?.some((p) => p.id === payload.id);
        const path = existing ? `/admin/products/${encodeURIComponent(payload.id)}` : "/admin/products";
        const result = await window.SMH.request(path, { method: existing ? "PATCH" : "POST", body: JSON.stringify(payload) });
        showMessage(result.message);
        productForm.reset();
        $("#admin-product-form-title").textContent = "Add a product";
        await Promise.all([loadProducts(), loadSummary()]);
      } catch (error) { showMessage(error.message, true); }
      finally { button.disabled = false; }
    });

    document.addEventListener("click", async (event) => {
      const edit = event.target.closest("[data-edit-product]");
      if (edit) {
        const product = $("#admin-products-table")._products?.find((p) => p.id === edit.dataset.editProduct);
        if (!product) return;
        const form = $("#admin-product-form");
        for (const [key, value] of Object.entries({ id: product.id, name: product.name, category: product.category, description: product.description, price: product.price, stock: product.stock, image: product.image })) {
          const input = form.elements.namedItem(key);
          if (input) input.value = value;
        }
        form.elements.namedItem("featured").checked = product.featured;
        form.elements.namedItem("active").checked = product.active;
        $("#admin-product-form-title").textContent = `Edit ${product.name}`;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      const save = event.target.closest("[data-save-status]");
      if (save) {
        const id = save.dataset.saveStatus;
        const select = document.querySelector(`[data-status-for="${CSS.escape(id)}"]`);
        if (!select?.value) { showMessage("Choose a new status first.", true); return; }
        save.disabled = true;
        try {
          const result = await window.SMH.request(`/admin/orders/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status: select.value }) });
          showMessage(result.message);
          await Promise.all([loadOrders(), loadSummary()]);
        } catch (error) { showMessage(error.message, true); }
        finally { save.disabled = false; }
      }
    });

    $("#admin-refresh")?.addEventListener("click", async () => {
      try { await Promise.all([loadSummary(), loadProducts(), loadOrders(), loadContactMessages(), loadNewsletter()]); showMessage("Admin data refreshed."); }
      catch (error) { showMessage(error.message, true); }
    });
  });
})();

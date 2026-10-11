(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const esc = window.SMH.escapeHtml;
  const labels = { pending: "Awaiting confirmation", confirmed: "Confirmed", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };

  document.addEventListener("DOMContentLoaded", async () => {
    const host = $("#orders-list");
    if (!host) return;
    host.innerHTML = '<p class="loading-state">Loading your orders…</p>';
    try {
      const result = await window.SMH.request("/orders");
      host.innerHTML = result.orders.length ? result.orders.map((order) => `
        <article class="order-card">
          <div class="order-card-top"><div><h3>${esc(order.id)}</h3><p>Placed ${esc(new Date(order.createdAt).toLocaleString())}</p></div><span class="status ${esc(order.status)}">${esc(labels[order.status] || order.status)}</span></div>
          <div class="order-card-top"><p>Recipient: ${esc(order.shippingName)}</p><strong>${window.SMH.money(order.total)}</strong></div>
          <a class="text-link" href="order-success.html?id=${encodeURIComponent(order.id)}">View order details →</a>
        </article>`).join("") : '<div class="empty-state"><h2>No orders yet.</h2><p>Your completed checkouts will appear here.</p><a class="btn" href="shop.html">Explore the collection</a></div>';
    } catch (error) {
      if (error.status === 401) {
        host.innerHTML = '<div class="empty-state"><h2>Sign in to view your orders.</h2><p>Your orders are private to your account.</p><a class="btn" href="account.html?next=orders.html">Sign in</a></div>';
      } else {
        host.innerHTML = `<div class="empty-state"><h2>Could not load orders.</h2><p>${esc(error.message)}</p></div>`;
      }
    }
  });
})();

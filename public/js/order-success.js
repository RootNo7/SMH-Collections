(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const esc = window.SMH.escapeHtml;
  const labels = { pending: "Awaiting confirmation", confirmed: "Confirmed", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };

  document.addEventListener("DOMContentLoaded", async () => {
    const host = $("#order-detail");
    if (!host) return;
    const id = new URL(window.location.href).searchParams.get("id");
    if (!id || !/^SMH-[0-9]{8}-[A-F0-9]{6}$/.test(id)) {
      host.innerHTML = '<div class="empty-state"><h2>Order not found.</h2><a class="btn" href="orders.html">Your orders</a></div>';
      return;
    }
    host.innerHTML = '<p class="loading-state">Retrieving order details…</p>';
    try {
      const { order } = await window.SMH.request(`/orders/${encodeURIComponent(id)}`);
      host.innerHTML = `
        <div class="card">
          <span class="section-label">Order reference</span><h2>${esc(order.id)}</h2>
          <p class="muted">Thank you. Your order has been recorded.</p>
          <p><span class="status ${esc(order.status)}">${esc(labels[order.status] || order.status)}</span></p>
          <hr>
          ${order.items.map((item) => `<div class="checkout-item"><img src="${esc(item.image)}" alt="${esc(item.name)}"><div><h3>${esc(item.name)}</h3><p>Quantity: ${item.quantity}</p></div><strong>${window.SMH.money(item.price * item.quantity)}</strong></div>`).join("")}
          <div class="summary-row"><span>Subtotal</span><strong>${window.SMH.money(order.subtotal)}</strong></div>
          <div class="summary-row"><span>Shipping</span><strong>${order.shipping ? window.SMH.money(order.shipping) : 'Free'}</strong></div>
          <div class="summary-total"><span>Total due on delivery</span><span>${window.SMH.money(order.total)}</span></div>
          <hr>
          <h3>Delivery details</h3><p>${esc(order.shippingName)}<br>${esc(order.addressLine1)}${order.addressLine2 ? `<br>${esc(order.addressLine2)}` : ''}<br>${esc(order.city)} ${esc(order.postalCode)}<br>${esc(order.phone)}</p>
          <p class="form-note">Payment method: Cash on delivery. SMH Collections has not collected online payment details.</p>
          <div class="cluster"><a class="btn" href="orders.html">View all orders</a><a class="btn btn-secondary" href="shop.html">Continue shopping</a></div>
        </div>`;
    } catch (error) {
      host.innerHTML = `<div class="empty-state"><h2>Could not load this order.</h2><p>${esc(error.message)}</p><a class="btn" href="account.html?next=orders.html">Sign in</a></div>`;
    }
  });
})();

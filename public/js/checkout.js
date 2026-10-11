(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = window.SMH.escapeHtml;

  function message(text, isError = false) {
    const el = $("#checkout-message");
    if (!el) return;
    el.textContent = text;
    el.className = `alert ${isError ? 'alert-error' : 'alert-success'}`;
    el.hidden = !text;
  }

  function renderSummary(cart) {
    const list = $("#checkout-items");
    const summary = $("#checkout-summary");
    if (list) {
      list.innerHTML = cart.items.length ? cart.items.map((item) => `
        <div class="checkout-item"><img src="${esc(item.image)}" alt="${esc(item.name)}"><div><h3>${esc(item.name)}</h3><p>Qty: ${item.quantity}</p></div><strong>${window.SMH.money(item.lineTotal)}</strong></div>`).join("") : '<p class="muted">Your bag is empty.</p>';
    }
    if (summary) {
      summary.innerHTML = `<div class="summary-row"><span>Subtotal</span><strong>${window.SMH.money(cart.subtotal)}</strong></div><div class="summary-row"><span>Shipping</span><strong>${cart.shipping ? window.SMH.money(cart.shipping) : (cart.items.length ? 'Free' : window.SMH.money(0))}</strong></div><div class="summary-total"><span>Total</span><span>${window.SMH.money(cart.total)}</span></div>`;
    }
    if (!cart.items.length) {
      const form = $("#checkout-form");
      if (form) form.hidden = true;
      message("Your bag is empty. Add something from the shop before checking out.", true);
    }
    const guestNote = $("#checkout-signin-note");
    if (guestNote) guestNote.hidden = !cart.guest;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const form = $("#checkout-form");
    if (!form) return;
    try {
      const cart = await window.SMH.getCart();
      renderSummary(cart);
    } catch (error) { message(error.message, true); }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      message("");
      const data = Object.fromEntries(new FormData(form).entries());
      data.paymentMethod = "cod";
      try {
        const result = await window.SMH.request("/orders", { method: "POST", body: JSON.stringify(data) });
        window.location.href = `order-success.html?id=${encodeURIComponent(result.order.id)}`;
      } catch (error) {
        if (error.status === 401) {
          message("Please sign in to place the order. Your guest bag will be merged into your account after sign-in.", true);
          const signIn = $("#checkout-signin-link");
          if (signIn) { signIn.href = "account.html?next=checkout.html"; signIn.textContent = "Sign in to continue"; signIn.hidden = false; }
        } else if (error.status === 403 && error.data?.code === "EMAIL_NOT_VERIFIED") {
          message(error.message, true);
          const verifyLink = $("#checkout-signin-link");
          if (verifyLink) { verifyLink.href = "account.html"; verifyLink.textContent = "Verify email in your account"; verifyLink.hidden = false; }
        } else {
          message(error.message, true);
        }
      } finally { button.disabled = false; }
    });
  });
})();

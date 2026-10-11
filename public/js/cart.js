(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = window.SMH.escapeHtml;

  function renderSummary(cart) {
    const target = $("#cart-summary");
    if (!target) return;
    target.innerHTML = `
      <div class="summary-card">
        <h2>Order summary</h2>
        <div class="summary-row"><span>Subtotal</span><strong>${window.SMH.money(cart.subtotal)}</strong></div>
        <div class="summary-row"><span>Shipping</span><strong>${cart.shipping ? window.SMH.money(cart.shipping) : (cart.items.length ? 'Free' : window.SMH.money(0))}</strong></div>
        <p class="form-note">${cart.subtotal >= 5000 ? 'Your order qualifies for free shipping.' : `Free shipping on orders of Rs. 5,000 or more.`}</p>
        <div class="summary-total"><span>Total</span><span>${window.SMH.money(cart.total)}</span></div>
        <a class="btn btn-primary btn-block" href="checkout.html" ${(cart.items.length && cart.items.every((item) => item.available !== false)) ? '' : 'aria-disabled="true"'}>Continue to checkout</a>
        <a class="text-link" href="shop.html" style="margin-top:16px">Continue shopping</a>
      </div>`;
  }

  function renderItems(cart) {
    const target = $("#cart-items");
    if (!target) return;
    if (!cart.items.length) {
      target.innerHTML = `<div class="empty-state"><span class="section-label">Your bag is waiting</span><h2>Nothing in the bag yet.</h2><p>Explore the collection and add something you love.</p><a class="btn" href="shop.html">Explore the shop</a></div>`;
      return;
    }
    target.innerHTML = cart.items.map((item) => `
      <article class="cart-item">
        <a href="product.html?id=${encodeURIComponent(item.id)}"><img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy"></a>
        <div><h3><a href="product.html?id=${encodeURIComponent(item.id)}">${esc(item.name)}</a></h3><p>${esc(item.category || 'SMH Collection')}</p>${item.available === false ? '<p class="form-note" style="color:var(--danger)">Currently unavailable or quantity exceeds stock.</p>' : ''}<div class="quantity-control" aria-label="Quantity for ${esc(item.name)}"><button type="button" data-cart-quantity="-1" data-id="${esc(item.id)}" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button type="button" data-cart-quantity="1" data-id="${esc(item.id)}" aria-label="Increase quantity" ${item.available === false || item.quantity >= item.stock ? 'disabled' : ''}>+</button></div><button class="remove-item" data-remove-cart-item="${esc(item.id)}" type="button">Remove</button></div>
        <div class="cart-item-price">${window.SMH.money(item.lineTotal)}</div>
      </article>`).join("");
  }

  async function refresh() {
    const target = $("#cart-items");
    try {
      const cart = await window.SMH.getCart();
      renderItems(cart);
      renderSummary(cart);
      await window.SMH.refreshHeaderCounts?.();
    } catch (error) {
      if (target) target.innerHTML = `<div class="empty-state"><h2>We couldn't load your bag.</h2><p>${esc(error.message)}</p><button class="btn btn-secondary" type="button" data-cart-retry>Try again</button></div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!$("#cart-items")) return;
    refresh();
    document.addEventListener("click", async (event) => {
      const quantity = event.target.closest("[data-cart-quantity]");
      const remove = event.target.closest("[data-remove-cart-item]");
      try {
        if (quantity) {
          const cart = await window.SMH.getCart();
          const item = cart.items.find((entry) => entry.id === quantity.dataset.id);
          const next = (item?.quantity || 0) + Number(quantity.dataset.cartQuantity);
          if (next < 1) await window.SMH.removeCartItem(quantity.dataset.id);
          else await window.SMH.updateCartItem(quantity.dataset.id, next);
          await refresh();
        } else if (remove) {
          await window.SMH.removeCartItem(remove.dataset.removeCartItem);
          await refresh();
        } else if (event.target.closest("[data-cart-retry]")) {
          await refresh();
        }
      } catch (error) { window.SMH.toast(error.message, "error"); }
    });
  });
})();

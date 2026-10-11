(() => {
  "use strict";
  const target = () => document.querySelector("#wishlist-products");
  const esc = window.SMH.escapeHtml;

  async function refresh() {
    const host = target();
    if (!host) return;
    host.innerHTML = '<p class="loading-state">Opening your saved pieces…</p>';
    try {
      const products = await window.SMH.getWishlist();
      host.innerHTML = products.length
        ? products.map(window.SMHProducts.card).join("")
        : '<div class="empty-state"><span class="section-label">Saved for later</span><h2>Your wishlist is empty.</h2><p>Keep track of the pieces you want to come back to.</p><a class="btn" href="shop.html">Browse the collection</a></div>';
    } catch (error) {
      host.innerHTML = `<div class="empty-state"><h2>Could not load your wishlist.</h2><p>${esc(error.message)}</p><button class="btn btn-secondary" data-wishlist-retry type="button">Try again</button></div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!target()) return;
    refresh();
    window.addEventListener("smh:wishlist-updated", refresh);
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-wishlist-retry]")) refresh();
    });
  });
})();

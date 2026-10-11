(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = window.SMH.escapeHtml;

  document.addEventListener("DOMContentLoaded", async () => {
    const target = $("#product-detail");
    const related = $("#related-products");
    if (!target) return;
    const id = new URL(window.location.href).searchParams.get("id");
    if (!id) {
      target.innerHTML = '<div class="empty-state"><h2>Choose a product first.</h2><a class="btn" href="shop.html">Browse the shop</a></div>';
      return;
    }
    target.innerHTML = '<p class="loading-state">Loading product…</p>';
    try {
      const { product, related: recommendations } = await window.SMH.request(`/products/${encodeURIComponent(id)}`);
      document.title = `${product.name} | SMH Collections`;
      const out = product.stock < 1;
      target.innerHTML = `
        <div class="product-gallery"><img src="${esc(product.image)}" alt="${esc(product.name)}"></div>
        <div class="product-detail-info">
          <div class="breadcrumb"><a href="index.html">Home</a><span>/</span><a href="shop.html">Shop</a><span>/</span><span>${esc(product.category)}</span></div>
          <span class="product-category">${esc(product.category)}</span>
          <h1>${esc(product.name)}</h1>
          <div class="product-price">${window.SMH.money(product.price)}</div>
          <p class="product-description">${esc(product.description)}</p>
          <div class="product-meta"><span>${out ? 'Currently unavailable' : `${product.stock} in stock`}</span><span>Shipping calculated at checkout</span><span>Cash on delivery available</span></div>
          <div class="product-buy-actions">
            <button type="button" class="btn btn-primary" data-add-to-cart data-id="${esc(product.id)}" data-name="${esc(product.name)}" data-category="${esc(product.category)}" data-price="${Number(product.price)}" data-image="${esc(product.image)}" data-stock="${Number(product.stock)}" ${out ? 'disabled' : ''}>${out ? 'Sold out' : 'Add to bag'}</button>
            <button type="button" class="btn btn-secondary" data-toggle-wishlist data-id="${esc(product.id)}">♡ Wishlist</button>
          </div>
          <hr>
          <p class="product-description">We keep our selection considered and straightforward. If you have a question about this item, <a class="text-link" href="contact.html">get in touch</a>.</p>
        </div>`;
      if (related) related.innerHTML = recommendations.length ? recommendations.map(window.SMHProducts.card).join("") : '<p class="muted">More pieces will be added soon.</p>';
    } catch (error) {
      target.innerHTML = `<div class="empty-state"><h2>Product unavailable.</h2><p>${esc(error.message)}</p><a class="btn btn-secondary" href="shop.html">Back to shop</a></div>`;
    }
  });
})();

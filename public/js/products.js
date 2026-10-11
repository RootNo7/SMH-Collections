(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = window.SMH.escapeHtml;

  function card(product) {
    const id = esc(product.id);
    const name = esc(product.name);
    const category = esc(product.category);
    const image = esc(product.image);
    const price = Number(product.price) || 0;
    const stock = Number(product.stock) || 0;
    return `
      <article class="product-card">
        <a class="product-media" href="product.html?id=${encodeURIComponent(product.id)}" aria-label="View ${name}">
          <img src="${image}" alt="${name}" loading="lazy" decoding="async">
          ${stock < 1 ? '<span class="product-badge out">Sold out</span>' : (product.featured ? '<span class="product-badge">Selected</span>' : '')}
        </a>
        <div class="product-actions">
          <button type="button" data-toggle-wishlist data-id="${id}">♡ Wishlist</button>
          <button type="button" data-add-to-cart data-id="${id}" data-name="${name}" data-category="${category}" data-price="${price}" data-image="${image}" data-stock="${stock}" ${stock < 1 ? 'disabled' : ''}>${stock < 1 ? 'Sold out' : 'Add to bag'}</button>
        </div>
        <div class="product-info">
          <span class="product-category">${category}</span>
          <a class="product-name" href="product.html?id=${encodeURIComponent(product.id)}">${name}</a>
          <div class="product-price">${window.SMH.money(price)}</div>
        </div>
      </article>`;
  }

  async function renderGrid(target, params = {}) {
    if (!target) return;
    target.innerHTML = '<p class="loading-state">Finding your next favourite…</p>';
    try {
      const search = new URLSearchParams();
      if (params.category) search.set("category", params.category);
      if (params.q) search.set("q", params.q);
      if (params.sort) search.set("sort", params.sort);
      if (params.limit) search.set("limit", String(params.limit));
      const result = await window.SMH.request(`/products?${search.toString()}`);
      target.innerHTML = result.products.length
        ? result.products.map(card).join("")
        : '<div class="empty-state"><h2>Nothing here just yet.</h2><p>Try a different search or category.</p><a class="btn btn-secondary" href="shop.html">View all products</a></div>';
      const count = $("[data-results-count]");
      if (count) count.textContent = `${result.total} item${result.total === 1 ? "" : "s"}`;
      const categories = $("[data-category-filters]");
      if (categories && !categories.dataset.ready) {
        categories.dataset.ready = "true";
        categories.innerHTML = ['All', ...result.categories].map((category) => {
          const active = (!params.category && category === 'All') || params.category === category;
          return `<button class="filter-btn ${active ? 'active' : ''}" type="button" data-category-filter="${esc(category === 'All' ? '' : category)}">${esc(category)}</button>`;
        }).join("");
      }
      target.dispatchEvent(new CustomEvent("smh:products-rendered", { bubbles: true, detail: result }));
    } catch (error) {
      target.innerHTML = `<div class="empty-state"><h2>We couldn't load the collection.</h2><p>${esc(error.message)}</p><button class="btn btn-secondary" data-retry-products type="button">Try again</button></div>`;
    }
  }

  window.SMHProducts = { card, renderGrid };

  document.addEventListener("DOMContentLoaded", () => {
    const featured = $("#featured-products");
    if (featured) renderGrid(featured, { sort: "featured", limit: 4 });

    const shopGrid = $("#shop-products");
    if (shopGrid) {
      const url = new URL(window.location.href);
      const state = {
        q: url.searchParams.get("q") || "",
        category: url.searchParams.get("category") || "",
        sort: url.searchParams.get("sort") || "featured"
      };
      const searchInput = $("#shop-search-input");
      const sortSelect = $("#shop-sort");
      const searchForm = $("#shop-search");
      if (searchInput) searchInput.value = state.q;
      if (sortSelect) sortSelect.value = state.sort;

      const refresh = () => renderGrid(shopGrid, state);
      searchForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        state.q = searchInput?.value.trim() || "";
        refresh();
      });
      sortSelect?.addEventListener("change", () => { state.sort = sortSelect.value; refresh(); });
      document.addEventListener("click", (event) => {
        const filter = event.target.closest("[data-category-filter]");
        if (filter) {
          state.category = filter.dataset.categoryFilter || "";
          document.querySelectorAll("[data-category-filter]").forEach((button) => button.classList.toggle("active", button === filter));
          refresh();
        }
        if (event.target.closest("[data-retry-products]")) refresh();
      });
      refresh();
    }
  });
})();

(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const escape = (value) => window.SMH.escapeHtml(value);

  // If an external editorial/product image is unavailable, show the bundled visual fallback.
  window.addEventListener("error", (event) => {
    const image = event.target;
    if (image instanceof HTMLImageElement && !image.dataset.fallback) {
      image.dataset.fallback = "true";
      image.src = "images/placeholder.svg";
    }
  }, true);

  function header() {
    return `
      <div class="announcement">Thoughtful essentials, chosen to be lived in. <a href="shop.html">Explore the collection</a></div>
      <header class="site-header">
        <div class="container header-inner">
          <a class="brand" href="index.html" aria-label="SMH Collections home">SMH <em>Collections</em></a>
          <nav class="main-nav" id="main-nav" aria-label="Main navigation">
            <a href="shop.html">Shop all</a>
            <a href="collections.html">Collections</a>
            <a href="about.html">Our story</a>
            <a href="contact.html">Contact</a>
          </nav>
          <div class="header-actions">
            <a class="icon-link" href="wishlist.html" aria-label="Wishlist" title="Wishlist">♡<span class="count-badge" id="wishlist-count" hidden>0</span></a>
            <a class="icon-link" href="cart.html" aria-label="Shopping bag" title="Shopping bag">▱<span class="count-badge" id="cart-count" hidden>0</span></a>
            <a class="icon-link" href="account.html" aria-label="Account" title="Account">◎</a>
            <button class="menu-toggle" type="button" aria-controls="main-nav" aria-expanded="false" aria-label="Toggle navigation">☰</button>
          </div>
        </div>
      </header>`;
  }

  window.SMH.refreshHeaderCounts = refreshCounts;

  function footer() {
    return `
      <footer class="site-footer">
        <div class="container footer-main">
          <div class="footer-about">
            <a class="footer-brand" href="index.html">SMH <em>Collections</em></a>
            <p>Considered everyday pieces, chosen for their usefulness, ease and lasting place in your wardrobe and home.</p>
          </div>
          <div class="footer-column"><h3>Explore</h3><div class="footer-links"><a href="shop.html">Shop all</a><a href="collections.html">Collections</a><a href="about.html">Our story</a><a href="wishlist.html">Wishlist</a></div></div>
          <div class="footer-column"><h3>Help</h3><div class="footer-links"><a href="contact.html">Contact us</a><a href="faq.html">FAQs</a><a href="account.html">Your account</a><a href="orders.html">Order history</a></div></div>
          <div class="footer-newsletter"><h3>A note from SMH</h3><p>Occasional updates on new arrivals and things worth keeping.</p><form data-newsletter><div class="form-group"><label for="newsletter-email">Email address</label><input id="newsletter-email" name="email" type="email" maxlength="254" autocomplete="email" placeholder="you@example.com" required></div><button class="btn btn-light btn-block" type="submit">Join the list</button><p data-newsletter-message role="status" aria-live="polite" hidden></p></form></div>
        </div>
        <div class="container footer-bottom"><p>© <span data-current-year></span> SMH Collections. All rights reserved.</p><div class="footer-legal"><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="faq.html">Shipping & returns</a></div><p>Designed with intention.</p></div>
      </footer>`;
  }

  async function refreshCounts() {
    try {
      const cart = await window.SMH.getCart();
      const cartCount = $("#cart-count");
      if (cartCount) {
        const count = cart.items.reduce((total, item) => total + item.quantity, 0);
        cartCount.textContent = String(count);
        cartCount.hidden = count === 0;
      }
    } catch {}
    try {
      const list = await window.SMH.getWishlist();
      const node = $("#wishlist-count");
      if (node) { node.textContent = String(list.length); node.hidden = list.length === 0; }
    } catch {}
  }

  document.addEventListener("DOMContentLoaded", () => {
    const headerHost = $("#site-header");
    const footerHost = $("#site-footer");
    if (headerHost) headerHost.innerHTML = header();
    if (footerHost) footerHost.innerHTML = footer();
    document.querySelectorAll("[data-current-year]").forEach((el) => { el.textContent = String(new Date().getFullYear()); });

    const toggle = $(".menu-toggle");
    const nav = $("#main-nav");
    toggle?.addEventListener("click", () => {
      const open = !nav.classList.contains("menu-open");
      nav.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "×" : "☰";
    });
    nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      nav.classList.remove("menu-open");
      toggle?.setAttribute("aria-expanded", "false");
      if (toggle) toggle.textContent = "☰";
    }));

    document.addEventListener("click", async (event) => {
      const addButton = event.target.closest("[data-add-to-cart]");
      if (addButton) {
        event.preventDefault();
        if (addButton.disabled) return;
        addButton.disabled = true;
        try {
          const product = { id: addButton.dataset.id, name: addButton.dataset.name, category: addButton.dataset.category, price: Number(addButton.dataset.price), image: addButton.dataset.image, stock: Number(addButton.dataset.stock) };
          await window.SMH.addToCart(product, 1);
          window.SMH.toast("Added to your bag.", "success");
          await refreshCounts();
        } catch (error) { window.SMH.toast(error.message, "error"); }
        finally { addButton.disabled = false; }
      }

      const wishlistButton = event.target.closest("[data-toggle-wishlist]");
      if (wishlistButton) {
        event.preventDefault();
        wishlistButton.disabled = true;
        try {
          const product = { id: wishlistButton.dataset.id };
          const added = await window.SMH.toggleWishlist(product);
          window.SMH.toast(added ? "Saved to your wishlist." : "Removed from your wishlist.", "success");
          wishlistButton.textContent = added ? "♥ Saved" : "♡ Wishlist";
          await refreshCounts();
          if (document.body.dataset.page === "wishlist") window.dispatchEvent(new Event("smh:wishlist-updated"));
        } catch (error) { window.SMH.toast(error.message, "error"); }
        finally { wishlistButton.disabled = false; }
      }
    });

    document.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-newsletter]");
      if (!form) return;
      event.preventDefault();
      const button = form.querySelector("button[type=submit]");
      const message = form.querySelector("[data-newsletter-message]");
      button.disabled = true;
      try {
        const email = new FormData(form).get("email");
        const result = await window.SMH.request("/newsletter", { method: "POST", body: JSON.stringify({ email }) });
        message.textContent = result.message;
        message.hidden = false;
        message.className = "alert alert-success";
        form.reset();
      } catch (error) {
        message.textContent = error.message;
        message.hidden = false;
        message.className = "alert alert-error";
      } finally { button.disabled = false; }
    });

    refreshCounts();
  });
})();

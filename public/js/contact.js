(() => {
  "use strict";
  document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("[data-contact-form]");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type=submit]");
      const message = form.querySelector("[data-form-message]");
      button.disabled = true;
      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        const result = await window.SMH.request("/contact", { method: "POST", body: JSON.stringify(payload) });
        message.textContent = result.message;
        message.className = "alert alert-success";
        message.hidden = false;
        form.reset();
      } catch (error) {
        message.textContent = error.message;
        message.className = "alert alert-error";
        message.hidden = false;
      } finally { button.disabled = false; }
    });
  });
})();

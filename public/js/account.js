(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = window.SMH.escapeHtml;

  function setMessage(element, text, error = false) {
    if (!element) return;
    element.textContent = text;
    element.className = `alert ${error ? 'alert-error' : 'alert-success'}`;
    element.hidden = !text;
  }
  function formMessage(form, text, error = false) { setMessage(form.querySelector("[data-form-message]"), text, error); }
  function renderUser(user) {
    const signedOut = $("#account-signed-out");
    const signedIn = $("#account-signed-in");
    if (signedOut) signedOut.hidden = Boolean(user);
    if (signedIn) signedIn.hidden = !user;
    if (user) {
      const name = $("#account-user-name");
      const email = $("#account-user-email");
      if (name) name.textContent = user.name;
      if (email) email.textContent = user.email;
      const profileName = $("#profile-name");
      if (profileName) profileName.value = user.name;
      const role = $("#account-role");
      if (role) role.textContent = user.role === "admin" ? "Administrator account" : "Customer account";
      const verificationNotice = $("#account-verification-notice");
      if (verificationNotice) verificationNotice.hidden = Boolean(user.emailVerified);
    }
  }
  async function refreshUser() {
    await window.SMH.getCsrfToken();
    const state = await window.SMH.request("/auth/me");
    renderUser(state.authenticated ? state.user : null);
    return state;
  }
  function safeNext() {
    const query = new URL(window.location.href).searchParams.get("next") || "";
    return ["checkout.html", "orders.html", "index.html"].includes(query) ? query : "";
  }
  async function completeAuth(result, form) {
    form.reset();
    await window.SMH.syncGuestData();
    await refreshUser();
    await window.SMH.refreshHeaderCounts?.();
    setMessage($("#account-global-message"), result.message || "Success.");
    const next = safeNext();
    if (next && (next !== "checkout.html" || result.user.emailVerified)) window.location.href = next;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const rootMessage = $("#account-global-message");
    const urlParams = new URL(window.location.href).searchParams;
    const resetToken = urlParams.get("reset");
    const verifyToken = urlParams.get("verify");
    const resetForm = $("[data-reset-form]");
    const verifyForm = $("[data-verify-form]");
    const signedOut = $("#account-signed-out");
    const signedIn = $("#account-signed-in");
    const forgotSection = $("#forgot-password-section");
    const verifySection = $("#verify-email-section");

    if (resetToken && resetForm) {
      if (signedOut) signedOut.hidden = true;
      if (signedIn) signedIn.hidden = true;
      if (forgotSection) forgotSection.hidden = true;
      resetForm.closest("section")?.removeAttribute("hidden");
    }
    if (verifyToken && verifyForm) {
      if (signedOut) signedOut.hidden = true;
      if (signedIn) signedIn.hidden = true;
      if (forgotSection) forgotSection.hidden = true;
      if (resetForm) resetForm.closest("section")?.setAttribute("hidden", "");
      verifySection?.removeAttribute("hidden");
      verifyForm.elements.namedItem("token").value = verifyToken;
    }

    try { await refreshUser(); }
    catch (error) { setMessage(rootMessage, error.message, true); }
    if (resetToken || verifyToken) {
      if (signedOut) signedOut.hidden = true;
      if (signedIn) signedIn.hidden = true;
    }

    document.addEventListener("submit", async (event) => {
      const form = event.target;
      const authType = form.dataset.authForm;
      if (!authType) return;
      event.preventDefault();
      const button = form.querySelector("button[type=submit]");
      if (button) button.disabled = true;
      const payload = Object.fromEntries(new FormData(form).entries());
      const endpoint = authType === "register" ? "/auth/register" : "/auth/login";
      try {
        const result = await window.SMH.request(endpoint, { method: "POST", body: JSON.stringify(payload) });
        await completeAuth(result, form);
      } catch (error) { formMessage(form, error.message, true); }
      finally { if (button) button.disabled = false; }
    });

    const profileForm = $("[data-profile-form]");
    profileForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = profileForm.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        const result = await window.SMH.request("/auth/me", {
          method: "PATCH", body: JSON.stringify({ name: new FormData(profileForm).get("name") })
        });
        renderUser(result.user);
        formMessage(profileForm, result.message);
      } catch (error) { formMessage(profileForm, error.message, true); }
      finally { button.disabled = false; }
    });

    const passwordForm = $("[data-password-form]");
    passwordForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = passwordForm.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        const payload = Object.fromEntries(new FormData(passwordForm).entries());
        const result = await window.SMH.request("/auth/change-password", { method: "POST", body: JSON.stringify(payload) });
        passwordForm.reset();
        formMessage(passwordForm, result.message);
      } catch (error) { formMessage(passwordForm, error.message, true); }
      finally { button.disabled = false; }
    });

    const logout = $("[data-auth-logout]");
    logout?.addEventListener("click", async () => {
      logout.disabled = true;
      try {
        const result = await window.SMH.request("/auth/logout", { method: "POST", body: JSON.stringify({}) });
        await window.SMH.getCsrfToken();
        renderUser(null);
        setMessage(rootMessage, result.message);
      } catch (error) { setMessage(rootMessage, error.message, true); }
      finally { logout.disabled = false; }
    });

    const forgotForm = $("[data-forgot-form]");
    forgotForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = forgotForm.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        const result = await window.SMH.request("/auth/forgot-password", {
          method: "POST", body: JSON.stringify({ email: new FormData(forgotForm).get("email") })
        });
        formMessage(forgotForm, result.message);
      } catch (error) { formMessage(forgotForm, error.message, true); }
      finally { button.disabled = false; }
    });

    const resendForm = $("[data-resend-verification]");
    resendForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = resendForm.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        const result = await window.SMH.request("/auth/resend-verification", { method: "POST", body: JSON.stringify({}) });
        formMessage(resendForm, result.message);
      } catch (error) { formMessage(resendForm, error.message, true); }
      finally { button.disabled = false; }
    });

    verifyForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = verifyForm.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        const token = verifyForm.elements.namedItem("token").value || verifyToken;
        const result = await window.SMH.request("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
        formMessage(verifyForm, result.message);
        window.history.replaceState({}, "", "account.html");
        await refreshUser();
        verifySection?.setAttribute("hidden", "");
        setMessage(rootMessage, result.message);
      } catch (error) { formMessage(verifyForm, error.message, true); }
      finally { button.disabled = false; }
    });

    resetForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = resetForm.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        const payload = Object.fromEntries(new FormData(resetForm).entries());
        payload.token = resetToken;
        const result = await window.SMH.request("/auth/reset-password", { method: "POST", body: JSON.stringify(payload) });
        resetForm.reset();
        formMessage(resetForm, result.message);
        window.history.replaceState({}, "", "account.html");
        setTimeout(() => { if (signedOut) signedOut.hidden = false; resetForm.closest("section")?.setAttribute("hidden", ""); }, 1200);
      } catch (error) { formMessage(resetForm, error.message, true); }
      finally { button.disabled = false; }
    });
  });
})();

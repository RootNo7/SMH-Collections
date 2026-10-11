const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function string(value, min, max) {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

function email(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value.trim());
}

function integer(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function safeSlug(value) {
  return typeof value === "string" && value.length <= 80 && SLUG_RE.test(value);
}

function imageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["images.unsplash.com", "images.pexels.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

function normalizedEmail(value) {
  return value.trim().toLowerCase();
}

module.exports = { string, email, integer, safeSlug, imageUrl, normalizedEmail };

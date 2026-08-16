/** Internal auth email domain — not shown to users; set per client deploy. */
export function authInternalDomain() {
  return (
    process.env.AUTH_INTERNAL_DOMAIN ??
    process.env.VITE_AUTH_INTERNAL_DOMAIN ??
    "trackweeb.cm"
  )
    .trim()
    .replace(/^@/, "");
}

export function usernameToAuthEmail(username) {
  const normalized = String(username ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) throw new Error("Username is required");
  if (!/^[a-z0-9._-]+$/.test(normalized)) {
    throw new Error("Username may only contain letters, numbers, dots, hyphens, and underscores");
  }
  return `${normalized}@auth.${authInternalDomain()}`;
}

export function authEmailToUsername(email) {
  if (!email) return null;
  const suffix = `@auth.${authInternalDomain()}`;
  if (!email.toLowerCase().endsWith(suffix)) return null;
  return email.slice(0, -suffix.length);
}

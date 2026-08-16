/** Internal auth email domain — users sign in with username only. */
function authInternalDomain(): string {
  const fromEnv = import.meta.env.VITE_AUTH_INTERNAL_DOMAIN;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim().replace(/^@/, "");
  }
  const siteUrl = import.meta.env.VITE_SITE_URL;
  if (siteUrl) {
    try {
      return new URL(siteUrl).host;
    } catch {
      /* fall through */
    }
  }
  return "trackweeb.cm";
}

export function usernameToAuthEmail(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (!normalized) throw new Error("Username is required");
  if (!/^[a-z0-9._-]+$/.test(normalized)) {
    throw new Error("Username may only contain letters, numbers, dots, hyphens, and underscores");
  }
  return `${normalized}@auth.${authInternalDomain()}`;
}

export function authEmailToUsername(email: string | null | undefined): string | null {
  if (!email) return null;
  const suffix = `@auth.${authInternalDomain()}`;
  if (!email.toLowerCase().endsWith(suffix)) return null;
  return email.slice(0, -suffix.length);
}

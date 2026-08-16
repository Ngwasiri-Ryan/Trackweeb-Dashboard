/**
 * Client-safe brand config — set VITE_* in .env per client deployment.
 */
function env(key: string, fallback: string): string {
  const value = import.meta.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

const name = env("VITE_APP_NAME", "Trackweeb");

export const brand = {
  name,
  legalName: env("VITE_APP_LEGAL_NAME", `${name} Logistics B.V.`),
  tagline: env("VITE_APP_TAGLINE", "Shipment tracking admin dashboard"),
  supportEmail: env("VITE_SUPPORT_EMAIL", "support@trackweeb.com"),
  logoLetter: env("VITE_APP_LOGO_LETTER", name.charAt(0).toUpperCase()),
  adminSuffix: env("VITE_ADMIN_SUFFIX", "Admin"),
  get adminTitle() {
    return env("VITE_ADMIN_TITLE", `${name} Admin`);
  },
  themeStorageKey: env("VITE_THEME_STORAGE_KEY", `${name.toLowerCase()}-admin-theme`),
  siteUrl: env("VITE_SITE_URL", "https://trackweeb.com"),
} as const;

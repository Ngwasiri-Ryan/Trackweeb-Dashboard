/** Fixed dashboard login — change here per client deploy. */
export const ADMIN_USERNAME = "trackweeb";
export const ADMIN_PASSWORD = "admin123";

/** Internal Supabase auth email (not shown in the UI). */
export const ADMIN_AUTH_EMAIL = "trackweeb@auth.trackweeb.cm";

export function credentialsMatch(username: string, password: string) {
  return username.trim().toLowerCase() === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

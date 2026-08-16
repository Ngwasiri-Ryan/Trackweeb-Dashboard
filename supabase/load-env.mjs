import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { usernameToAuthEmail } from "./lib/auth-username.mjs";

export function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

export function loadProjectEnv() {
  loadDotEnv(resolve(__dirname, "../.env"));
  loadDotEnv(resolve(__dirname, ".env"));
}

export function getSetupConfig() {
  loadProjectEnv();

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "";
  const dbPassword = process.env.SUPABASE_DB_PASSWORD ?? "";
  const dbRegion = process.env.SUPABASE_DB_REGION ?? "eu-west-1";
  const dbPooler = process.env.SUPABASE_DB_POOLER ?? "aws-1";
  const dbUrl =
    process.env.SUPABASE_DB_URL ??
    (projectRef && dbPassword
      ? `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@${dbPooler}-${dbRegion}.pooler.supabase.com:5432/postgres`
      : "");

  const adminUsername = process.env.ADMIN_USERNAME ?? "trackweeb";
  const adminAuthEmail =
    process.env.ADMIN_AUTH_EMAIL ??
    process.env.ADMIN_EMAIL ??
    usernameToAuthEmail(adminUsername);

  return {
    supabaseUrl,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    dbUrl,
    adminUsername,
    adminAuthEmail,
    adminPassword: process.env.ADMIN_PASSWORD ?? "admin123",
    adminFullName: process.env.ADMIN_FULL_NAME ?? "Admin",
    tenantName: process.env.TENANT_NAME ?? "Logistics Inc",
    tenantSubdomain: process.env.TENANT_SUBDOMAIN ?? "logistics-inc",
    tenantId: "a0000000-0000-4000-8000-000000000001",
  };
}

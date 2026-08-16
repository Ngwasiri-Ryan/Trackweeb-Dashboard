#!/usr/bin/env node
/**
 * Idempotent Supabase bootstrap: schema + seed + admin user.
 * Skips entirely when tenant and admin profile already exist.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { getSetupConfig, loadProjectEnv } from "./load-env.mjs";
import { seedDemoData } from "./seed-demo.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function authHeaders(serviceKey) {
  return {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    "Content-Type": "application/json",
  };
}

async function api(config, path, opts = {}) {
  const res = await fetch(`${config.supabaseUrl}${path}`, {
    ...opts,
    headers: { ...authHeaders(config.serviceKey), ...opts.headers },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

async function isSchemaReady(config) {
  const { ok, data } = await api(
    config,
    `/rest/v1/tenants?select=id&subdomain=eq.${encodeURIComponent(config.tenantSubdomain)}&limit=1`,
  );
  if (!ok) {
    if (data?.code === "PGRST205") return false;
    throw new Error(`Tenant check failed: ${JSON.stringify(data)}`);
  }
  return Array.isArray(data) && data.length > 0;
}

async function findUserByEmail(config, email) {
  const { ok, data } = await api(config, "/auth/v1/admin/users?page=1&per_page=1000");
  if (!ok) throw new Error(`List users failed: ${JSON.stringify(data)}`);
  return (data.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function isAdminReady(config) {
  const user = await findUserByEmail(config, config.adminEmail);
  if (!user) return false;

  const { ok, data } = await api(config, `/rest/v1/profiles?select=id&id=eq.${user.id}&limit=1`);
  if (!ok) {
    if (data?.code === "PGRST205") return false;
    throw new Error(`Profile check failed: ${JSON.stringify(data)}`);
  }
  return Array.isArray(data) && data.length > 0;
}

const POOLER_REGIONS = [
  process.env.SUPABASE_DB_REGION,
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-central-1",
  "eu-north-1",
  "us-east-1",
].filter(Boolean);

const POOLER_PREFIXES = ["aws-1", "aws-0"];

function poolerUrl(projectRef, password, region, prefix = "aws-1") {
  return `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@${prefix}-${region}.pooler.supabase.com:5432/postgres`;
}

async function connectPostgres(config) {
  const projectRef = config.supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "";
  const password = process.env.SUPABASE_DB_PASSWORD ?? "";
  const candidates = [
    config.dbUrl,
    ...POOLER_PREFIXES.flatMap((prefix) =>
      POOLER_REGIONS.map((region) => poolerUrl(projectRef, password, region, prefix)),
    ),
  ].filter(Boolean);

  let lastError = null;
  for (const connectionString of [...new Set(candidates)]) {
    const client = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20_000,
    });
    try {
      await client.connect();
      return client;
    } catch (err) {
      lastError = err;
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
  }
  throw lastError ?? new Error("Could not connect to Supabase Postgres.");
}

async function applySchema(config, log = console.log) {
  if (!config.dbUrl && !process.env.SUPABASE_DB_PASSWORD) {
    throw new Error("SUPABASE_DB_PASSWORD (or SUPABASE_DB_URL) is required to create tables.");
  }

  const sql = readFileSync(join(__dirname, "full-bootstrap.sql"), "utf8");
  const client = await connectPostgres(config);
  try {
    log("Applying database schema and seed…");
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function ensureTenant(config, log = console.log) {
  const upsert = await api(config, "/rest/v1/tenants?on_conflict=subdomain", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([
      {
        id: config.tenantId,
        name: config.tenantName,
        subdomain: config.tenantSubdomain,
        timezone: "Europe/London",
        is_active: true,
      },
    ]),
  });
  if (!upsert.ok) throw new Error(`Tenant upsert failed: ${JSON.stringify(upsert.data)}`);
  log(`Tenant ready: ${config.tenantName}`);
}

async function ensureAuthUser(config, log = console.log) {
  let create = await api(config, "/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: config.adminEmail,
      password: config.adminPassword,
      email_confirm: true,
      user_metadata: { full_name: config.adminFullName },
    }),
  });

  if (create.ok) {
    log(`Created admin user: ${config.adminEmail}`);
    return create.data.id ?? create.data.user?.id;
  }

  if (create.status === 422 || create.data?.msg?.includes("already")) {
    const existing = await findUserByEmail(config, config.adminEmail);
    if (!existing) throw new Error(`User exists but could not be found: ${config.adminEmail}`);

    const update = await api(config, `/auth/v1/admin/users/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({
        password: config.adminPassword,
        email_confirm: true,
        user_metadata: { full_name: config.adminFullName },
      }),
    });
    if (update.ok) log(`Admin user ready: ${config.adminEmail}`);
    return existing.id;
  }

  throw new Error(`Create user failed (${create.status}): ${JSON.stringify(create.data)}`);
}

async function ensureProfile(config, userId, log = console.log) {
  const upsert = await api(config, "/rest/v1/profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([
      {
        id: userId,
        tenant_id: config.tenantId,
        full_name: config.adminFullName,
        role: "admin",
        is_active: true,
      },
    ]),
  });
  if (!upsert.ok) throw new Error(`Profile upsert failed: ${JSON.stringify(upsert.data)}`);
  log(`Admin profile linked: ${config.adminEmail}`);
}

async function ensureAdmin(config, log = console.log) {
  await ensureTenant(config, log);
  const userId = await ensureAuthUser(config, log);
  await ensureProfile(config, userId, log);
}

/**
 * @returns {Promise<{ alreadySetup: boolean; skipped?: boolean; reason?: string; schemaApplied?: boolean; adminApplied?: boolean }>}
 */
export async function ensureSetup(options = {}) {
  loadProjectEnv();
  const config = getSetupConfig();
  const log = options.silent ? () => {} : (msg) => console.log(msg);

  if (!config.supabaseUrl || !config.serviceKey) {
    return {
      alreadySetup: false,
      skipped: true,
      reason: "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env",
    };
  }

  let schemaReady = false;
  let adminReady = false;

  try {
    schemaReady = await isSchemaReady(config);
    adminReady = schemaReady ? await isAdminReady(config) : false;
  } catch (err) {
    return { alreadySetup: false, skipped: true, reason: err instanceof Error ? err.message : String(err) };
  }

  if (schemaReady && adminReady) {
    log("Trackweeb setup already complete — skipping schema/admin.");
    await seedDemoData({ silent: options.silent });
    return { alreadySetup: true };
  }

  if (!schemaReady) {
    await applySchema(config, log);
  }

  if (!adminReady) {
    await ensureAdmin(config, log);
  }

  await seedDemoData({ silent: options.silent });

  log("Trackweeb setup finished.");
  return {
    alreadySetup: false,
    schemaApplied: !schemaReady,
    adminApplied: !adminReady,
  };
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isCli) {
  ensureSetup()
    .then((result) => {
      if (result.skipped && result.reason) {
        console.warn(`Setup skipped: ${result.reason}`);
        process.exit(0);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TENANT_ID = "a0000000-0000-4000-8000-000000000001";

function config() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "";
  const dbPassword = Deno.env.get("SUPABASE_DB_PASSWORD") ?? "";
  const dbUrl =
    Deno.env.get("SUPABASE_DB_URL") ??
    (projectRef && dbPassword
      ? `postgres://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`
      : "");

  return {
    supabaseUrl,
    serviceKey,
    dbUrl,
    adminEmail: Deno.env.get("ADMIN_EMAIL") ?? "ryanngwasiri@gmail.com",
    adminPassword: Deno.env.get("ADMIN_PASSWORD") ?? "admin123",
    adminFullName: Deno.env.get("ADMIN_FULL_NAME") ?? "Admin",
    tenantName: Deno.env.get("TENANT_NAME") ?? "Logistics Inc",
    tenantSubdomain: Deno.env.get("TENANT_SUBDOMAIN") ?? "logistics-inc",
  };
}

async function isSchemaReady(admin: ReturnType<typeof createClient>, tenantSubdomain: string) {
  const { data, error } = await admin.from("tenants").select("id").eq("subdomain", tenantSubdomain).limit(1);
  if (error) {
    if (error.code === "PGRST205" || error.message.includes("Could not find the table")) return false;
    throw error;
  }
  return (data?.length ?? 0) > 0;
}

async function isAdminReady(admin: ReturnType<typeof createClient>, email: string) {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  const user = listed.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) return false;

  const { data, error } = await admin.from("profiles").select("id").eq("id", user.id).limit(1);
  if (error) {
    if (error.code === "PGRST205") return false;
    throw error;
  }
  return (data?.length ?? 0) > 0;
}

async function applySchema(dbUrl: string) {
  const sql = await Deno.readTextFile(new URL("./full-bootstrap.sql", import.meta.url));
  const sqlClient = postgres(dbUrl, { ssl: "require", max: 1 });
  try {
    await sqlClient.unsafe(sql);
  } finally {
    await sqlClient.end({ timeout: 5 });
  }
}

async function ensureAdmin(admin: ReturnType<typeof createClient>, cfg: ReturnType<typeof config>) {
  const { error: tenantError } = await admin.from("tenants").upsert(
    {
      id: TENANT_ID,
      name: cfg.tenantName,
      subdomain: cfg.tenantSubdomain,
      timezone: "Europe/London",
      is_active: true,
    },
    { onConflict: "subdomain" },
  );
  if (tenantError) throw tenantError;

  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let userId = listed?.users.find((u) => u.email?.toLowerCase() === cfg.adminEmail.toLowerCase())?.id;

  if (!userId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: cfg.adminEmail,
      password: cfg.adminPassword,
      email_confirm: true,
      user_metadata: { full_name: cfg.adminFullName },
    });
    if (createError) throw createError;
    userId = created.user.id;
  } else {
    await admin.auth.admin.updateUserById(userId, {
      password: cfg.adminPassword,
      email_confirm: true,
      user_metadata: { full_name: cfg.adminFullName },
    });
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      tenant_id: TENANT_ID,
      full_name: cfg.adminFullName,
      role: "admin",
      is_active: true,
    },
    { onConflict: "id" },
  );
  if (profileError) throw profileError;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const cfg = config();
    if (!cfg.supabaseUrl || !cfg.serviceKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "Missing Supabase credentials" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(cfg.supabaseUrl, cfg.serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const schemaReady = await isSchemaReady(admin, cfg.tenantSubdomain);
    const adminReady = schemaReady ? await isAdminReady(admin, cfg.adminEmail) : false;

    if (schemaReady && adminReady) {
      return new Response(JSON.stringify({ alreadySetup: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!schemaReady) {
      if (!cfg.dbUrl) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "SUPABASE_DB_PASSWORD secret required for first-time setup" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      await applySchema(cfg.dbUrl);
    }

    if (!adminReady) {
      await ensureAdmin(admin, cfg);
    }

    return new Response(
      JSON.stringify({
        alreadySetup: false,
        schemaApplied: !schemaReady,
        adminApplied: !adminReady,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ alreadySetup: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

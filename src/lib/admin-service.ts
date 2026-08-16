import { supabase } from "./supabase";

async function hashKey(plaintext: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plaintext));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function listApiKeys() {
  const { data, error } = await supabase.from("api_keys").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createApiKey(tenantId: string, input: { name: string; permissions?: string[]; expires_at?: string }) {
  const plaintext = `tk_live_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const keyHash = await hashKey(plaintext);
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      tenant_id: tenantId,
      key_hash: keyHash,
      name: input.name,
      permissions: input.permissions ?? ["read:shipments"],
      expires_at: input.expires_at ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return { api_key: data, plaintext_key: plaintext };
}

export async function revokeApiKey(id: string) {
  const { error } = await supabase.from("api_keys").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

export async function listContactMessages() {
  const { data, error } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}

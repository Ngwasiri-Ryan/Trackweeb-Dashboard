import {
  createApiKey as createApiKeyDb,
  listApiKeys,
  revokeApiKey as revokeApiKeyDb,
} from "../admin-service";
import {
  createRoute,
  deactivateRoute,
  getRoute,
  getTenant,
  listModes,
  listRoutes,
  listStatuses,
  updateRoute,
  updateTenant,
} from "../routes-service";
import { requireProfile } from "../supabase";

export type ApiKey = {
  id: string;
  name: string;
  permissions: string[];
  expires_at: string | null;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
};

export function fetchModes() {
  return listModes().then((data) => ({ data }));
}

export function fetchStatuses() {
  return listStatuses().then((data) => ({ data }));
}

export function fetchRoutes(is_active?: boolean) {
  return listRoutes(is_active).then((data) => ({ data }));
}

export function fetchRoute(id: string) {
  return getRoute(id);
}

export { createRoute, updateRoute, deactivateRoute };

export function fetchTenant() {
  return getTenant();
}

export { updateTenant };

export function fetchApiKeys() {
  return listApiKeys().then((rows) => ({
    data: rows.map((k) => ({
      id: k.id,
      name: k.name,
      permissions: (k.permissions as string[]) ?? [],
      expires_at: k.expires_at,
      last_used_at: k.last_used_at,
      is_active: k.is_active,
      created_at: k.created_at,
    })),
  }));
}

export async function createApiKey(body: {
  name: string;
  permissions?: string[];
  expires_at?: string;
}) {
  const { profile } = await requireProfile();
  const result = await createApiKeyDb(profile.tenant_id, body);
  return {
    api_key: {
      id: result.api_key.id,
      name: result.api_key.name,
      permissions: (result.api_key.permissions as string[]) ?? [],
      expires_at: result.api_key.expires_at,
      last_used_at: result.api_key.last_used_at,
      is_active: result.api_key.is_active,
      created_at: result.api_key.created_at,
    },
    plaintext_key: result.plaintext_key,
  };
}

export function revokeApiKey(id: string) {
  return revokeApiKeyDb(id);
}

export async function updateApiKey(
  id: string,
  body: { name?: string; permissions?: string[]; expires_at?: string | null },
) {
  const { supabase } = await import("../supabase");
  const { error } = await supabase.from("api_keys").update(body).eq("id", id);
  if (error) throw error;
  const keys = await listApiKeys();
  const key = keys.find((k) => k.id === id);
  if (!key) throw new Error("API key not found");
  return {
    id: key.id,
    name: key.name,
    permissions: (key.permissions as string[]) ?? [],
    expires_at: key.expires_at,
    last_used_at: key.last_used_at,
    is_active: key.is_active,
    created_at: key.created_at,
  } satisfies ApiKey;
}

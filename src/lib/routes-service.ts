import { supabase, requireProfile } from "./supabase";

export async function listRoutes(is_active?: boolean) {
  let q = supabase.from("routes").select("*, modes(code, display_name)").order("created_at", { ascending: false });
  if (is_active !== undefined) q = q.eq("is_active", is_active);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    mode_id: r.mode_id,
    mode: {
      id: r.mode_id,
      code: (r.modes as { id?: string; code: string; display_name: string })?.code ?? "road",
      display_name: (r.modes as { code: string; display_name: string })?.display_name ?? "Road",
    },
    origin: r.origin,
    destination: r.destination,
    distance_km: Number(r.distance_km),
    default_duration_hours: Number(r.default_duration_hours),
    is_active: r.is_active,
    created_at: r.created_at,
  }));
}

export async function getRoute(id: string) {
  const { data, error } = await supabase.from("routes").select("*, modes(code, display_name)").eq("id", id).single();
  if (error) throw error;
  return {
    id: data.id,
    mode_id: data.mode_id,
    mode: {
      id: data.mode_id,
      code: (data.modes as { code: string; display_name: string }).code,
      display_name: (data.modes as { code: string; display_name: string }).display_name,
    },
    origin: data.origin,
    destination: data.destination,
    distance_km: Number(data.distance_km),
    default_duration_hours: Number(data.default_duration_hours),
    is_active: data.is_active,
    created_at: data.created_at,
  };
}

export async function createRoute(input: {
  mode_id: string;
  origin: string;
  destination: string;
  distance_km: number;
  default_duration_hours: number;
}) {
  const { profile } = await requireProfile();
  const { data, error } = await supabase
    .from("routes")
    .insert({ tenant_id: profile.tenant_id, ...input })
    .select("*, modes(code, display_name)")
    .single();
  if (error) throw error;
  return getRoute(data.id);
}

export async function updateRoute(
  id: string,
  input: Partial<{
    origin: string;
    destination: string;
    distance_km: number;
    default_duration_hours: number;
    is_active: boolean;
  }>,
) {
  const { error } = await supabase.from("routes").update(input).eq("id", id);
  if (error) throw error;
  return getRoute(id);
}

export async function deactivateRoute(id: string) {
  const { error } = await supabase.from("routes").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

export async function getTenant() {
  const { profile } = await requireProfile();
  const tenant = profile.tenants as {
    id: string;
    name: string;
    subdomain: string;
    logo_url: string | null;
    timezone: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  return tenant;
}

export async function updateTenant(input: { name?: string; logo_url?: string; timezone?: string }) {
  const { profile } = await requireProfile();
  const { data, error } = await supabase
    .from("tenants")
    .update(input)
    .eq("id", profile.tenant_id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listModes() {
  const { data, error } = await supabase.from("modes").select("*").eq("is_active", true).order("display_name");
  if (error) throw error;
  return data ?? [];
}

export async function listStatuses() {
  const { data, error } = await supabase.from("statuses").select("*").order("step_order");
  if (error) throw error;
  return data ?? [];
}

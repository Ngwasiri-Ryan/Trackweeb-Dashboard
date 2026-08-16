import { useQuery } from "@tanstack/react-query";
import { supabase, getProfile } from "./supabase";
import { listShipments } from "./shipments-service";
import { getShipment } from "./shipments-service";
import { searchShipments } from "./dashboard-service";

export function useAuthUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const result = await getProfile();
      if (!result) throw new Error("Not authenticated");
      const tenant = result.profile.tenants as { id: string; name: string; subdomain: string };
      return {
        id: result.user.id,
        email: result.user.email ?? "",
        full_name: result.profile.full_name,
        tenant_id: result.profile.tenant_id,
        tenant: tenant,
        tenant_name: tenant?.name,
      };
    },
    retry: false,
  });
}

export function useIsAuthed() {
  return useQuery({
    queryKey: ["auth", "session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return !!data.session;
    },
  });
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function useShipmentCount() {
  return useQuery({
    queryKey: ["shipments", "count"],
    queryFn: () => listShipments({ limit: 1, page: 1 }),
    staleTime: 60_000,
  });
}

export function useShipmentBreadcrumb(id: string | null) {
  return useQuery({
    queryKey: ["shipment", id, "breadcrumb"],
    queryFn: () => getShipment(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useGlobalSearch(q: string) {
  return useQuery({
    queryKey: ["search", q],
    queryFn: () => searchShipments(q),
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  });
}

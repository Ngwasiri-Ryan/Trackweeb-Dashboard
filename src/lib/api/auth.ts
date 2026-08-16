import { supabase, getProfile } from "../supabase";

export type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  tenant_id: string;
  tenant?: {
    id: string;
    name: string;
    subdomain: string;
    logo_url: string | null;
    timezone: string;
  };
  tenant_name?: string;
};

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const profile = await getProfile();
  if (!profile) throw new Error("Profile not found");
  const tenant = profile.profile.tenants as {
    id: string;
    name: string;
    subdomain: string;
    logo_url: string | null;
    timezone: string;
  };
  return {
    token: data.session?.access_token ?? "",
    expires_at: data.session?.expires_at ?? "",
    user: {
      id: profile.user.id,
      email: profile.user.email ?? email,
      full_name: profile.profile.full_name,
      role: profile.profile.role ?? "admin",
      tenant_id: profile.profile.tenant_id,
      tenant,
      tenant_name: tenant.name,
    } satisfies AdminUser,
  };
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function fetchMe(): Promise<AdminUser> {
  const profile = await getProfile();
  if (!profile) throw new Error("Not authenticated");
  const tenant = profile.profile.tenants as {
    id: string;
    name: string;
    subdomain: string;
    logo_url: string | null;
    timezone: string;
  };
  return {
    id: profile.user.id,
    email: profile.user.email ?? "",
    full_name: profile.profile.full_name,
    role: profile.profile.role ?? "admin",
    tenant_id: profile.profile.tenant_id,
    tenant,
    tenant_name: tenant.name,
  };
}

export async function changePassword(current_password: string, new_password: string) {
  const { error } = await supabase.auth.updateUser({ password: new_password });
  if (error) throw error;
  void current_password;
  return { message: "Password updated" };
}

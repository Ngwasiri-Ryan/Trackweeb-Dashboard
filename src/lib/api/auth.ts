import { supabase, getProfile } from "../supabase";
import {
  ADMIN_AUTH_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  credentialsMatch,
} from "../admin-credentials";

export type AdminUser = {
  id: string;
  username: string;
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

export async function login(username: string, password: string) {
  if (!credentialsMatch(username, password)) {
    throw new Error("Invalid username or password");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_AUTH_EMAIL,
    password: ADMIN_PASSWORD,
  });
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
      username: ADMIN_USERNAME,
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
    username: ADMIN_USERNAME,
    full_name: profile.profile.full_name,
    role: profile.profile.role ?? "admin",
    tenant_id: profile.profile.tenant_id,
    tenant,
    tenant_name: tenant.name,
  };
}

export async function changePassword(_current_password: string, _new_password: string) {
  throw new Error("This dashboard uses fixed credentials configured in admin-credentials.ts");
}

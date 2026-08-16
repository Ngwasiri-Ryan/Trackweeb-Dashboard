import { supabase, getProfile } from "../supabase";
import { authEmailToUsername, usernameToAuthEmail } from "../auth-username";

export type AdminUser = {
  id: string;
  username: string;
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

function resolveUsername(email: string, metadata?: Record<string, unknown>) {
  const fromMeta = metadata?.username;
  if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim().toLowerCase();
  return authEmailToUsername(email) ?? email;
}

export async function login(username: string, password: string) {
  const authEmail = usernameToAuthEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
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
  const resolvedUsername = resolveUsername(profile.user.email ?? authEmail, profile.user.user_metadata);
  return {
    token: data.session?.access_token ?? "",
    expires_at: data.session?.expires_at ?? "",
    user: {
      id: profile.user.id,
      username: resolvedUsername,
      email: profile.user.email ?? authEmail,
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
  const email = profile.user.email ?? "";
  return {
    id: profile.user.id,
    username: resolveUsername(email, profile.user.user_metadata),
    email,
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

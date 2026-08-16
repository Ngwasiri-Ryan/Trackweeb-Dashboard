import { supabase } from "./supabase";

export type SetupStatus = {
  alreadySetup: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
};

async function ensureSetupDev(): Promise<SetupStatus> {
  const res = await fetch("/api/ensure-setup");
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as SetupStatus;
    return { alreadySetup: false, error: body.error ?? `Setup failed (${res.status})` };
  }
  return (await res.json()) as SetupStatus;
}

async function ensureSetupProd(): Promise<SetupStatus> {
  const { data, error } = await supabase.functions.invoke("ensure-setup");
  if (error) {
    return { alreadySetup: false, error: error.message };
  }
  return (data ?? { alreadySetup: false }) as SetupStatus;
}

/** Runs once per page load; no-op when Supabase is already provisioned. */
export async function ensureAppSetup(): Promise<SetupStatus> {
  try {
    if (import.meta.env.DEV) {
      return await ensureSetupDev();
    }
    return await ensureSetupProd();
  } catch (err) {
    return {
      alreadySetup: false,
      error: err instanceof Error ? err.message : "Setup check failed",
    };
  }
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { useEffect, useState, type ReactNode } from "react";
import {
  Building2,
  Clock,
  Globe,
  Image,
  KeyRound,
  Lock,
  Mail,
  Shield,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  AppShell,
  DashboardHero,
  SurfaceCard,
} from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { changePassword, fetchMe } from "@/lib/api/auth";
import { fetchTenant, updateTenant } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";

function SettingsField({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div>
        <Label className="text-xs font-bold text-foreground">{label}</Label>
        {description ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-right text-xs font-semibold text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const meQ = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe });
  const tenantQ = useQuery({ queryKey: ["tenant"], queryFn: fetchTenant });

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");

  const tenant = tenantQ.data;
  const me = meQ.data;

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      setTimezone(tenant.timezone);
      setLogoUrl(tenant.logo_url ?? "");
    }
  }, [tenant]);

  const tenantM = useMutation({
    mutationFn: () =>
      updateTenant({
        name: name || undefined,
        timezone: timezone || undefined,
        logo_url: logoUrl || undefined,
      }),
    onSuccess: () => {
      toast.success("Organization settings saved");
      qc.invalidateQueries({ queryKey: ["tenant"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Save failed"),
  });

  const pwM = useMutation({
    mutationFn: () => changePassword(currentPw, newPw),
    onSuccess: () => {
      toast.success("Password updated");
      setCurrentPw("");
      setNewPw("");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Password change failed"),
  });

  return (
    <AppShell>
      <DashboardHero
        eyebrow="Account"
        title="Settings"
        description="Manage your admin profile, organization details, and security preferences."
      />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="settings-tabs">
          <TabsTrigger value="profile" className="settings-tab-trigger">
            <User className="mr-1.5 h-3.5 w-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="organization" className="settings-tab-trigger">
            <Building2 className="mr-1.5 h-3.5 w-3.5" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="security" className="settings-tab-trigger">
            <Shield className="mr-1.5 h-3.5 w-3.5" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-0 space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <SurfaceCard className="space-y-4 lg:col-span-1" padded>
              <div className="flex flex-col items-center text-center">
                <div className="profile-avatar">
                  {(me?.full_name?.[0] ?? me?.username?.[0] ?? "A").toUpperCase()}
                </div>
                <h3 className="mt-3 text-sm font-bold text-foreground">{me?.full_name ?? "Admin"}</h3>
                <p className="text-xs text-muted-foreground">@{me?.username ?? "admin"}</p>
                <span className="verified-badge mt-2">
                  <Shield className="h-3 w-3" />
                  Verified admin
                </span>
              </div>
            </SurfaceCard>

            <SurfaceCard className="space-y-1 lg:col-span-2" padded>
              <div className="settings-section-header mb-4">
                <User className="h-4 w-4 text-muted-foreground" />
                <h3 className="section-heading">Account Details</h3>
              </div>
              <InfoRow label="Full name" value={me?.full_name ?? "—"} />
              <InfoRow label="Username" value={me?.username ?? "—"} mono />
              <InfoRow label="Organization" value={me?.tenant?.name ?? me?.tenant_name ?? "—"} />
              <InfoRow label="Role" value="Administrator" />
            </SurfaceCard>
          </div>
        </TabsContent>

        <TabsContent value="organization" className="mt-0 space-y-6">
          <SurfaceCard className="space-y-5" padded>
            <div className="settings-section-header">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <h3 className="section-heading">Organization Settings</h3>
                <p className="text-[11px] text-muted-foreground">
                  Branding and regional preferences for your tenant workspace.
                </p>
              </div>
            </div>

            <SettingsField label="Organization name" description="Displayed across receipts and client notifications.">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="settings-input" />
            </SettingsField>

            <SettingsField label="Timezone" description="Used for ETA calculations and dashboard date boundaries.">
              <div className="relative">
                <Globe className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="UTC"
                  className="settings-input pl-9"
                />
              </div>
            </SettingsField>

            <SettingsField label="Logo URL" description="Optional logo shown on printed waybills and receipts.">
              <div className="relative">
                <Image className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://…"
                  className="settings-input pl-9"
                />
              </div>
            </SettingsField>

            {tenant && (
              <div className="info-panel">
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Subdomain: <strong className="font-mono text-foreground">{tenant.subdomain}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Updated {formatDateTime(tenant.updated_at)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button className="btn-action-primary" disabled={tenantM.isPending} onClick={() => tenantM.mutate()}>
                Save organization
              </Button>
            </div>
          </SurfaceCard>
        </TabsContent>

        <TabsContent value="security" className="mt-0 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <SurfaceCard className="space-y-5" padded>
              <div className="settings-section-header">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <h3 className="section-heading">Change Password</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Use a strong password you don&apos;t reuse elsewhere.
                  </p>
                </div>
              </div>

              <SettingsField label="Current password">
                <Input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="settings-input"
                />
              </SettingsField>

              <SettingsField label="New password">
                <Input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="settings-input"
                />
              </SettingsField>

              <Button
                className="btn-action-primary w-full"
                disabled={!currentPw || !newPw || pwM.isPending}
                onClick={() => pwM.mutate()}
              >
                Update password
              </Button>
            </SurfaceCard>

            <SurfaceCard className="space-y-4" padded>
              <div className="settings-section-header">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <h3 className="section-heading">API Access</h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Manage programmatic access keys for integrations, webhooks, and third-party dispatch tools.
              </p>
              <Button variant="outline" className="btn-action-secondary" asChild>
                <Link to="/api-keys">Manage API keys</Link>
              </Button>
            </SurfaceCard>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

import type { ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  Clock,
  Globe,
  Plus,
  TrendingUp,
  Truck,
} from "lucide-react";
import {
  AppShell,
  DashboardHero,
  DashboardKpiCard,
  SurfaceCard,
} from "@/components/layout/AppShell";
import { brand } from "@/lib/brand";
import { EmptyState } from "@/components/admin/empty-state";
import { ModeIcon } from "@/components/admin/mode-icon";
import { ShipmentStatusBadge } from "@/components/admin/shipment-status-badge";
import { StatTilesSkeleton } from "@/components/admin/table-skeleton";
import { AdminLiveMap } from "@/components/admin/live-map-lazy";
import {
  fetchDashboardSummary,
  fetchDelayedShipments,
  fetchDeliveryPerformance,
  fetchLiveMap,
  fetchRecentActivity,
  fetchStatsActivity,
  fetchStatsByMode,
  fetchStatsByStatus,
} from "@/lib/api/dashboard";
import { formatDateTime, formatRelative } from "@/lib/format";

const MODE_ICONS: Record<string, ReactNode> = {
  road: <ModeIcon code="road" size="md" />,
  air: <ModeIcon code="air" size="md" />,
  sea: <ModeIcon code="sea" size="md" />,
  rail: <ModeIcon code="rail" size="md" />,
};

function modeIcon(code: string) {
  return MODE_ICONS[code] ?? <ModeIcon code={code} size="md" />;
}

function ActivityTrendChart({
  data,
}: {
  data: { date: string; created: number; delivered: number }[];
}) {
  const maxVal = Math.max(1, ...data.flatMap((d) => [d.created, d.delivered]));
  const yTicks = [maxVal, Math.ceil(maxVal * 0.67), Math.ceil(maxVal * 0.25)];

  return (
    <div className="chart-area sm:gap-6 sm:px-8">
      {yTicks.map((tick, i) => (
        <div
          key={tick}
          className="chart-grid-line"
          style={{ top: `${i * 33}%` }}
        >
          <span className="absolute -top-2 left-0">{tick}</span>
        </div>
      ))}

      {data.slice(-3).map((point) => {
        const createdH = Math.max(8, (point.created / maxVal) * 144);
        const deliveredH = Math.max(8, (point.delivered / maxVal) * 144);
        const label = point.date.slice(5);

        return (
          <div key={point.date} className="z-10 flex flex-1 flex-col items-center gap-2">
            <div className="flex h-36 w-full max-w-16 items-end justify-center gap-1">
              <div
                className="chart-bar--created w-7 sm:w-8"
                style={{ height: `${createdH}px` }}
                title={`Created: ${point.created}`}
              />
              <div
                className="chart-bar--delivered w-7 sm:w-8"
                style={{ height: `${deliveredH}px` }}
                title={`Delivered: ${point.delivered}`}
              />
            </div>
            <span className="font-mono text-[10px] font-semibold text-muted-foreground">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const summaryQ = useQuery({ queryKey: ["dashboard", "summary"], queryFn: () => fetchDashboardSummary() });
  const liveMapQ = useQuery({ queryKey: ["dashboard", "live-map-preview"], queryFn: () => fetchLiveMap() });
  const delayedQ = useQuery({ queryKey: ["dashboard", "delayed"], queryFn: fetchDelayedShipments });
  const activityQ = useQuery({ queryKey: ["dashboard", "activity"], queryFn: () => fetchRecentActivity(8) });
  const byModeQ = useQuery({ queryKey: ["dashboard", "by-mode"], queryFn: fetchStatsByMode });
  const byStatusQ = useQuery({ queryKey: ["dashboard", "by-status"], queryFn: fetchStatsByStatus });
  const perfQ = useQuery({ queryKey: ["dashboard", "perf"], queryFn: () => fetchDeliveryPerformance() });
  const trendQ = useQuery({ queryKey: ["dashboard", "trend"], queryFn: () => fetchStatsActivity() });

  const summary = summaryQ.data;
  const livePreview = liveMapQ.data?.data.slice(0, 6) ?? [];
  const trendData = trendQ.data?.data ?? [];

  return (
    <AppShell>
      <DashboardHero
        eyebrow={brand.adminTitle}
        title="Operations command center"
        description="Monitor fleet health, delays, and delivery performance in real time."
        actions={
          <>
            <Link to="/shipments/new" className="btn-action-primary">
              <Plus className="h-3.5 w-3.5" />
              New shipment
            </Link>
            <Link to="/live-map" className="btn-action-secondary">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              Live map
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summaryQ.isLoading ? (
          <StatTilesSkeleton count={4} />
        ) : (
          <>
            <DashboardKpiCard
              label="In transit"
              value={summary?.in_transit ?? "—"}
              hint="Active shipments moving now"
              variant="info"
              icon={<Truck className="h-4 w-4" />}
              to="/shipments"
              search={{ status: "in_transit" }}
            />
            <DashboardKpiCard
              label="Today's departures"
              value={summary?.today_departures ?? "—"}
              hint="Dispatched on schedule"
              variant="default"
              icon={<Clock className="h-4 w-4" />}
              to="/shipments"
            />
            <DashboardKpiCard
              label="Active delays"
              value={summary?.active_delays ?? "—"}
              hint="Requires attention"
              variant="delay"
              icon={<AlertTriangle className="h-4 w-4" />}
              to="/shipments"
              search={{ delayed: "1" }}
            />
            <DashboardKpiCard
              label="Delivered today"
              value={summary?.delivered_today ?? "—"}
              hint="Completed deliveries"
              variant="success"
              icon={<Box className="h-4 w-4" />}
              to="/shipments"
              search={{ status: "delivered" }}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SurfaceCard className="flex flex-col justify-between space-y-4 lg:col-span-2" padded>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="section-heading">Live Fleet</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Real-time GPS telemetry stream from active transport units.
              </p>
            </div>
            <Link to="/live-map" className="link-accent">
              Full live map
              <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <AdminLiveMap items={livePreview} height="420px" />
          </div>
        </SurfaceCard>

        <SurfaceCard className="space-y-5" padded>
          <div className="space-y-1">
            <h3 className="section-heading">Delivery Performance</h3>
            {perfQ.data ? (
              <div className="flex items-baseline gap-2 pt-1">
                <span className="font-mono text-3xl font-black text-foreground">
                  {perfQ.data.on_time_percentage}%
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  On-time (30 days)
                </span>
                <TrendingUp className="ml-auto h-4 w-4 text-success" />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Loading…</p>
            )}
          </div>

          {perfQ.data && (
            <div className="grid grid-cols-2 gap-2">
              <div className="stat-tile stat-tile--success">
                <div className="stat-tile__value font-mono text-lg font-black">
                  {perfQ.data.on_time}
                </div>
                <div className="stat-tile__label text-[10px] font-semibold">On time</div>
              </div>
              <div className="stat-tile stat-tile--destructive">
                <div className="stat-tile__value font-mono text-lg font-black">
                  {perfQ.data.delayed}
                </div>
                <div className="stat-tile__label text-[10px] font-semibold">Delayed</div>
              </div>
            </div>
          )}

          <div className="space-y-2 border-t border-border pt-2">
            <div className="section-heading mb-2 text-[10px]">By Transport Mode</div>
            <div className="space-y-2 text-xs">
              {(byModeQ.data?.data ?? []).map((m) => (
                <div key={m.mode_code} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold text-foreground">
                    {modeIcon(m.mode_code)}
                    {m.mode_name}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {m.in_transit} in transit • {m.delayed} delayed
                  </span>
                </div>
              ))}
            </div>
          </div>
        </SurfaceCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SurfaceCard className="space-y-4 lg:col-span-2" padded>
          <h3 className="section-heading">Activity Trend</h3>
          {trendData.length > 0 ? (
            <ActivityTrendChart data={trendData} />
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No activity data yet</p>
          )}
          <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="chart-bar--created h-2 w-2 rounded-sm" /> Created
            </span>
            <span className="flex items-center gap-1.5">
              <span className="chart-bar--delivered h-2 w-2 rounded-sm" /> Delivered
            </span>
          </div>
        </SurfaceCard>

        <SurfaceCard className="space-y-4" padded>
          <h3 className="section-heading">Status Breakdown</h3>
          <div className="divide-y divide-border text-xs font-semibold">
            {(byStatusQ.data?.data ?? []).map((s) => (
              <div key={s.status} className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-2 text-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color_hex }} />
                  {s.display_name}
                </span>
                <span className="font-mono font-bold text-foreground">{s.count}</span>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard className="space-y-3" padded>
        <div className="flex items-center justify-between">
          <h3 className="section-heading">Delayed Shipments</h3>
          <Link to="/shipments" search={{ delayed: "1" }} className="link-accent">
            View all
            <ArrowRight className="h-2.5 w-2.5" />
          </Link>
        </div>

        {(delayedQ.data?.data ?? []).length === 0 ? (
          <EmptyState
            icon={<Truck className="h-5 w-5" />}
            title="No active delays"
            description="Fleet looks healthy right now."
          />
        ) : (
          <div className="space-y-3">
            {delayedQ.data!.data.slice(0, 5).map((s) => (
              <Link
                key={s.id}
                to="/shipments/$id"
                params={{ id: s.id }}
                className="alert-card sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tracking-code-sm">{s.tracking_code}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {s.receiver_name} → {s.destination}
                    </span>
                  </div>
                  {s.latest_delay && (
                    <p className="text-xs font-medium text-destructive">
                      {s.latest_delay.reason} · ETA {formatDateTime(s.latest_delay.new_eta)}
                    </p>
                  )}
                </div>
                <ShipmentStatusBadge status={s.status} />
              </Link>
            ))}
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard className="space-y-4" padded>
        <h3 className="section-heading">Recent Activity</h3>
        <div className="divide-y divide-border text-xs">
          {(activityQ.data?.data ?? []).map((a, i) => (
            <div
              key={`${a.shipment_id}-${i}`}
              className="flex flex-col justify-between gap-1 py-3 sm:flex-row sm:items-center"
            >
              <div>
                <div className="font-bold text-foreground">{a.description}</div>
                <Link
                  to="/shipments/$id"
                  params={{ id: a.shipment_id }}
                  className="link-accent tracking-code inline-flex"
                >
                  {a.tracking_code}
                  <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                </Link>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {formatRelative(a.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </AppShell>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  LayoutGrid,
  ListChecks,
  Loader2,
  Mail,
  Map,
  MapPin,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Route as RouteIcon,
  Trash2,
  TriangleAlert,
  Truck,
  Warehouse,
  Weight,
} from "lucide-react";
import { toast } from "sonner";
import {
  AppShell,
  DetailSpecTile,
  KpiCard,
  SectionLabel,
  StatusBadge,
  SurfaceCard,
  TabBar,
} from "@/components/layout/AppShell";
import { ShipmentLiveMap } from "@/components/admin/live-map-lazy";
import { ActivityTimeline } from "@/components/admin/activity-timeline";
import { CopyButton } from "@/components/admin/copy-button";
import { ShipmentBarcode } from "@/components/admin/shipment-barcode";
import { ShipmentReceiptViewer } from "@/components/admin/shipment-receipt-viewer";
import { StatusChangeDialog } from "@/components/admin/status-change-dialog";
import { DeleteShipmentDialog } from "@/components/admin/delete-shipment-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchStatuses } from "@/lib/api/admin";
import {
  archiveShipment,
  clearDelay,
  createDelay,
  createLocationLog,
  createTimelineEvent,
  fetchDelays,
  fetchLocationLogs,
  fetchShipmentFull,
  fetchShipmentLive,
  fetchTimelineEvents,
  overrideEta,
  recalculateEta,
  updateLivePosition,
  updateShipmentStatus,
} from "@/lib/api/shipments";
import { ApiError } from "@/lib/api/client";
import { formatDateTime, formatDurationFromHours, formatRelative } from "@/lib/format";

function formatServiceType(value: string | null | undefined) {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDimensions(
  dims: { length_cm?: number; width_cm?: number; height_cm?: number } | null | undefined,
) {
  if (!dims) return "—";
  const parts = [dims.length_cm, dims.width_cm, dims.height_cm].filter((v) => v != null);
  if (parts.length === 0) return "—";
  return `${dims.length_cm ?? "—"} × ${dims.width_cm ?? "—"} × ${dims.height_cm ?? "—"} cm`;
}

export default function ShipmentDetailPage() {
  const { id: routeId } = useParams();
  const id = routeId!;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [statusChange, setStatusChange] = useState<{ from: string; to: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fullQ = useQuery({
    queryKey: ["shipment", id, "full"],
    queryFn: () => fetchShipmentFull(id),
  });
  const liveQ = useQuery({
    queryKey: ["shipment", id, "live"],
    queryFn: () => fetchShipmentLive(id),
    refetchInterval: tab === "live" ? 5_000 : 30_000,
    enabled: tab === "live" || tab === "overview",
  });
  const timelineQ = useQuery({
    queryKey: ["shipment", id, "timeline"],
    queryFn: () => fetchTimelineEvents(id),
    enabled: tab === "timeline",
  });
  const delaysQ = useQuery({
    queryKey: ["shipment", id, "delays"],
    queryFn: () => fetchDelays(id),
    enabled: tab === "delays",
  });
  const logsQ = useQuery({
    queryKey: ["shipment", id, "logs"],
    queryFn: () => fetchLocationLogs(id),
    enabled: tab === "locations",
  });
  const statusesQ = useQuery({ queryKey: ["statuses"], queryFn: fetchStatuses });

  const s = fullQ.data?.shipment;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["shipment", id] });
    qc.invalidateQueries({ queryKey: ["shipments"] });
  };

  const statusM = useMutation({
    mutationFn: ({ status, description }: { status: string; description?: string }) =>
      updateShipmentStatus(id, { status, description }),
    onSuccess: (res) => {
      setStatusChange(null);
      if (res.notification?.sent) {
        toast.success(`Status updated — email sent to ${res.notification.sent_to}`);
      } else if (res.notification?.error) {
        toast.warning(`Status updated, but email failed: ${res.notification.error}`);
      } else if (!s?.receiver_email) {
        toast.success("Status updated (no client email on file)");
      } else {
        toast.success("Status updated");
      }
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Update failed"),
  });

  const recalcM = useMutation({
    mutationFn: () => recalculateEta(id),
    onSuccess: () => {
      toast.success("ETA recalculated");
      invalidate();
    },
  });

  const archiveM = useMutation({
    mutationFn: () => archiveShipment(id),
    onSuccess: () => {
      toast.success("Shipment deleted");
      navigate({ to: "/shipments" });
    },
  });

  if (fullQ.isLoading) {
    return (
      <AppShell>
        <p className="py-20 text-center text-muted-foreground">Loading shipment…</p>
      </AppShell>
    );
  }

  if (!s) {
    return (
      <AppShell>
        <p className="py-20 text-center text-muted-foreground">Shipment not found</p>
      </AppShell>
    );
  }

  const progress = Math.round(liveQ.data?.progress_percent ?? s.progress_percent ?? 0);

  const distanceKm = s.distance_km ?? liveQ.data?.distance_km ?? null;
  const speedKmh = s.speed_kmh ?? liveQ.data?.speed_kmh ?? null;
  const travelHours =
    distanceKm != null && speedKmh != null && speedKmh > 0
      ? distanceKm / speedKmh
      : null;

  const remainingHours =
    s.is_delayed && liveQ.data?.motion?.remaining_hours != null
      ? liveQ.data.motion.remaining_hours
      : travelHours;

  const routeSourceLabel =
    liveQ.data?.polyline_source === "google_directions"
      ? s.mode.code === "rail"
        ? "Google Maps transit"
        : "Google Maps route"
      : s.mode.code === "air"
        ? "Great-circle (air)"
        : s.mode.code === "sea"
          ? "Great-circle (sea)"
          : "Great-circle path";

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <Link
          to="/shipments"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to all shipments
        </Link>

        <div className="flex items-center gap-2">
          <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
            Last updated:{" "}
            <span className="font-mono text-muted-foreground">{formatRelative(s.updated_at)}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              void fullQ.refetch();
              void liveQ.refetch();
              toast.success("Data synced with central server.");
            }}
            className="rounded-lg border border-transparent p-2 text-muted-foreground transition hover:border-border hover:bg-card hover:text-foreground"
            title="Refresh page data"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <SurfaceCard className="space-y-4 p-6" padded={false}>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <StatusBadge status={s.status} />
              {s.is_delayed ? (
                <span className="delay-badge">
                  <TriangleAlert className="h-3 w-3" />
                  Delayed
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                <Truck className="h-3 w-3 text-muted-foreground" />
                {s.mode.display_name}
              </span>
              {s.service_type ? (
                <span className="priority-badge">
                  {formatServiceType(s.service_type)}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <h1 className="tracking-code text-2xl font-black tracking-tight sm:text-3xl">
                {s.tracking_code}
              </h1>
              <CopyButton value={s.tracking_code} size="icon" label="Copy tracking code" />
            </div>

            <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="font-semibold text-foreground">{s.receiver_name}</span>
              <span className="text-muted-foreground/40">•</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                {s.origin}
              </span>
              <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40" />
              <span className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="text-accent h-3 w-3" />
                {s.destination}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-2 lg:border-t-0 lg:pt-0">
            <div className="hidden flex-wrap items-center gap-2 lg:flex">
              <Link
                to="/shipments/$id/edit"
                params={{ id }}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted/50"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                Edit
              </Link>
              <button
                type="button"
                onClick={() => recalcM.mutate()}
                disabled={recalcM.isPending}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted/50 disabled:opacity-50"
              >
                {recalcM.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                Recalc ETA
              </button>
              <div className="relative">
                <Select value="" onValueChange={(v) => setStatusChange({ from: s.status, to: v })}>
                  <SelectTrigger className="h-9 w-[190px] rounded-xl border-border text-xs font-semibold shadow-sm">
                    <SelectValue placeholder="Update status" />
                  </SelectTrigger>
                  <SelectContent>
                    {(statusesQ.data?.data ?? []).map((st) => (
                      <SelectItem key={st.code} value={st.code} disabled={st.code === s.status}>
                        Update status: {st.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="btn-destructive-soft"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-xl lg:hidden" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/shipments/$id/edit" params={{ id }}>Edit shipment</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => recalcM.mutate()} disabled={recalcM.isPending}>
                  Recalculate ETA
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteOpen(true)}>
                  Delete shipment
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        <KpiCard
          compact
          variant="violet"
          label="Est. distance"
          value={distanceKm != null ? `${distanceKm} km` : "—"}
          hint={routeSourceLabel}
          icon={<RouteIcon className="h-4 w-4" />}
        />
        <KpiCard
          compact
          variant="info"
          label={s.is_delayed ? "Remaining time" : "Travel time"}
          value={formatDurationFromHours(remainingHours)}
          hint={
            s.is_delayed
              ? "To revised ETA (delay active)"
              : distanceKm != null && speedKmh
                ? `${distanceKm} km ÷ ${speedKmh} km/h`
                : undefined
          }
          icon={<Clock className="h-4 w-4" />}
        />
        <KpiCard
          compact
          variant="info"
          label="Est. arrival"
          value={formatDateTime(s.final_eta).split(" · ")[0] ?? formatDateTime(s.final_eta)}
          hint={
            <span className="font-mono">
              {formatDateTime(s.final_eta).includes("·")
                ? formatDateTime(s.final_eta).split(" · ")[1]
                : "—"}
            </span>
          }
          icon={<Clock className="h-4 w-4" />}
        />
        <KpiCard
          compact
          variant="info"
          label="Departed"
          value={formatDateTime(s.depart_time).split(" · ")[0] ?? formatDateTime(s.depart_time)}
          hint={
            <span className="font-mono">
              {formatDateTime(s.depart_time).includes("·")
                ? formatDateTime(s.depart_time).split(" · ")[1]
                : "—"}
            </span>
          }
          icon={<Truck className="h-4 w-4" />}
        />
        <KpiCard
          compact
          variant="info"
          label="Progress"
          value={`${progress}%`}
          icon={<Loader2 className="h-4 w-4 animate-spin" />}
        >
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </KpiCard>
        <KpiCard
          compact
          variant="warning"
          label="Weight"
          value={s.weight_kg != null ? `${s.weight_kg} kg` : "—"}
          hint={s.parcel_quantity ? `${s.parcel_quantity} parcel${s.parcel_quantity > 1 ? "s" : ""}` : undefined}
          icon={<Weight className="h-4 w-4" />}
        />
      </div>

      <SurfaceCard className="route-timing-card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4" padded={false}>
        <div>
          <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Estimated distance</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {distanceKm != null ? `${distanceKm} km` : "—"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {s.origin} → {s.destination}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Travel time (v = d ÷ t)</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{formatDurationFromHours(travelHours)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {distanceKm != null && speedKmh ? `At ${speedKmh} km/h` : "Set speed to calculate"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Estimated arrival</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{formatDateTime(s.final_eta)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Depart {formatDateTime(s.depart_time)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Speed &amp; progress</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {speedKmh != null ? `${speedKmh} km/h` : "—"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{progress}% of route complete</p>
        </div>
      </SurfaceCard>

      <StatusChangeDialog
        open={!!statusChange}
        onOpenChange={(open) => !open && setStatusChange(null)}
        trackingCode={s.tracking_code}
        currentStatus={statusChange?.from ?? s.status}
        newStatus={statusChange?.to ?? s.status}
        receiverEmail={s.receiver_email}
        receiverName={s.receiver_name}
        pending={statusM.isPending}
        onConfirm={(description) =>
          statusChange && statusM.mutate({ status: statusChange.to, description })
        }
      />

      <DeleteShipmentDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        trackingCode={s.tracking_code}
        pending={archiveM.isPending}
        onConfirm={() => archiveM.mutate()}
      />

      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
          { id: "receipt", label: "Receipt", icon: <Mail className="h-3.5 w-3.5" /> },
          { id: "live", label: "Live map", icon: <Map className="h-3.5 w-3.5" /> },
          { id: "timeline", label: "Timeline & activity", icon: <ListChecks className="h-3.5 w-3.5" /> },
          { id: "delays", label: "Delays & exceptions", icon: <TriangleAlert className="h-3.5 w-3.5" /> },
          { id: "locations", label: "Hub locations", icon: <Warehouse className="h-3.5 w-3.5" /> },
        ]}
      />

      {tab === "overview" && (
        <div className="space-y-6">
          <ShipmentBarcode
            shipmentId={id}
            trackingCode={s.tracking_code}
            onViewReceipt={() => setTab("receipt")}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailSpecTile
              label="Shipping date"
              value={s.shipping_date ? formatDateTime(s.shipping_date) : formatDateTime(s.depart_time)}
            />
            <DetailSpecTile label="Departed hub" value={formatDateTime(s.depart_time)} />
            <DetailSpecTile
              label="Est. distance"
              value={distanceKm != null ? `${distanceKm} km` : "—"}
            />
            <DetailSpecTile
              label="Travel time"
              value={formatDurationFromHours(travelHours)}
            />
            <DetailSpecTile label="Est. arrival" value={formatDateTime(s.final_eta)} />
            <DetailSpecTile label="Trip progress" value={`${progress}% complete`} />
            <DetailSpecTile
              label="Gross weight"
              value={s.weight_kg != null ? `${s.weight_kg} kg` : "—"}
            />
            <DetailSpecTile
              label="Vehicle speed (live)"
              value={
                s.speed_kmh != null ? (
                  <span className="live-indicator">
                    <span className="live-indicator__dot" />
                    {s.speed_kmh} km/h
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <DetailSpecTile
              label="Service tier"
              value={formatServiceType(s.service_type) || s.mode.display_name}
              mono={false}
            />
            <DetailSpecTile
              label="Parcels count"
              value={
                s.parcel_quantity
                  ? `${s.parcel_quantity} unit${s.parcel_quantity > 1 ? "s" : ""}${
                      s.parcel_dimensions ? ` · ${formatDimensions(s.parcel_dimensions)}` : ""
                    }`
                  : "1 unit"
              }
            />
          </div>

          {s.current_location_text ? (
            <div className="live-location-banner flex items-center justify-between rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-sm">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <div className="section-heading text-[10px]">Current live location</div>
                  <div className="text-sm font-bold text-foreground">{s.current_location_text}</div>
                </div>
              </div>
            </div>
          ) : null}

          <SurfaceCard className="space-y-6 p-6" padded={false}>
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-muted-foreground uppercase">
                <Warehouse className="h-3.5 w-3.5 text-foreground" />
                Parties &amp; detailed route information
              </h3>
              <span className="font-mono text-xs text-muted-foreground">Waybill #{s.tracking_code.split("-").pop()}</span>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/50 p-4">
                <div className="flex items-center gap-2 border-b border-border/50 pb-2 text-xs font-bold tracking-wider text-foreground uppercase">
                  <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
                  Consignor / origin
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Sender:</span>
                    <span className="font-bold text-foreground">{s.sender_name}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Origin hub:</span>
                    <span className="font-semibold text-foreground">{s.origin}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Departed timestamp:</span>
                    <span className="font-mono text-foreground">{formatDateTime(s.depart_time)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/50 p-4">
                <div className="flex items-center gap-2 border-b border-border/50 pb-2 text-xs font-bold tracking-wider text-foreground uppercase">
                  <MapPin className="text-accent h-3.5 w-3.5" />
                  Consignee / destination
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Receiver:</span>
                    <span className="font-bold text-foreground">{s.receiver_name}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Client email:</span>
                    <span className="text-accent font-mono font-semibold">{s.receiver_email ?? "—"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Destination hub:</span>
                    <span className="font-semibold text-foreground">{s.destination}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">System ETA:</span>
                    <span className="font-mono font-bold text-foreground">{formatDateTime(s.system_calculated_eta)}</span>
                  </div>
                </div>
              </div>
            </div>

            {s.notes ? (
              <div className="space-y-1 border-t border-border/40 pt-4">
                <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Special notes &amp; handling instructions
                </span>
                <p className="rounded-xl border border-border/50 bg-muted/50 p-3 font-mono text-xs text-foreground">
                  {s.notes}
                </p>
              </div>
            ) : null}
          </SurfaceCard>

          {liveQ.data ? (
            <SurfaceCard className="shipment-map-card w-full space-y-4 p-4 sm:p-6" padded={false}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-muted-foreground uppercase">
                    <Map className="h-3.5 w-3.5 text-foreground" />
                    Interactive route preview
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Live GPS tracking stream between {s.origin} and {s.destination}.
                  </p>
                </div>
                {s.distance_km ? (
                  <span className="rounded-lg border border-border bg-muted px-2.5 py-1 font-mono text-xs font-bold text-foreground">
                    Total: {s.distance_km} km
                  </span>
                ) : null}
              </div>
              <ShipmentLiveMap
                origin={liveQ.data.origin}
                destination={liveQ.data.destination}
                current={liveQ.data.current}
                geopath={liveQ.data.geopath}
                modeCode={liveQ.data.mode_code}
                polylineSource={liveQ.data.polyline_source}
                status={liveQ.data.status}
                departTime={liveQ.data.depart_time}
                speedKmh={liveQ.data.speed_kmh}
                progressPercent={liveQ.data.progress_percent}
                isDelayed={liveQ.data.is_delayed}
                motion={liveQ.data.motion}
                height="min(52vh, 560px)"
              />
            </SurfaceCard>
          ) : null}

          <EtaOverridePanel shipmentId={id} currentOverride={s.manual_override_eta} onDone={invalidate} />
        </div>
      )}

      {tab === "receipt" && (
        <ShipmentReceiptViewer shipmentId={id} trackingCode={s.tracking_code} />
      )}

      {tab === "live" && (
        liveQ.data ? (
          <>
            <SurfaceCard className="shipment-map-card shipment-map-card--live w-full space-y-4 p-4 sm:p-6 lg:p-8" padded={false}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Expanded live fleet telematics</h3>
                <span className="font-mono text-xs text-muted-foreground">{s.tracking_code}</span>
              </div>
              <ShipmentLiveMap
                origin={liveQ.data.origin}
                destination={liveQ.data.destination}
                current={liveQ.data.current}
                geopath={liveQ.data.geopath}
                modeCode={liveQ.data.mode_code}
                polylineSource={liveQ.data.polyline_source}
                status={liveQ.data.status}
                departTime={liveQ.data.depart_time}
                speedKmh={liveQ.data.speed_kmh}
                progressPercent={liveQ.data.progress_percent}
                isDelayed={liveQ.data.is_delayed}
                motion={liveQ.data.motion}
                height="min(78vh, 760px)"
              />
            </SurfaceCard>
            <LivePositionForm shipmentId={id} onDone={invalidate} />
          </>
        ) : (
          <p className="py-10 text-center text-muted-foreground">Loading live view…</p>
        )
      )}

      {tab === "timeline" && (
        <TimelinePanel
          shipmentId={id}
          events={timelineQ.data?.data ?? fullQ.data?.timeline_events ?? []}
          statuses={statusesQ.data?.data ?? []}
          onDone={invalidate}
          loading={timelineQ.isLoading}
        />
      )}

      {tab === "delays" && (
        <DelaysPanel
          shipmentId={id}
          delays={delaysQ.data?.data ?? fullQ.data?.delays ?? []}
          isDelayed={s.is_delayed}
          onDone={invalidate}
          loading={delaysQ.isLoading}
        />
      )}

      {tab === "locations" && (
        <LocationsPanel
          shipmentId={id}
          logs={logsQ.data?.data ?? fullQ.data?.location_logs ?? []}
          onDone={invalidate}
          loading={logsQ.isLoading}
        />
      )}
    </AppShell>
  );
}

function EtaOverridePanel({
  shipmentId,
  currentOverride,
  onDone,
}: {
  shipmentId: string;
  currentOverride: string | null;
  onDone: () => void;
}) {
  const [eta, setEta] = useState(currentOverride?.slice(0, 16) ?? "");
  const [reason, setReason] = useState("");

  const m = useMutation({
    mutationFn: () =>
      overrideEta(shipmentId, {
        manual_override_eta: eta ? new Date(eta).toISOString() : null,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      toast.success("ETA override saved");
      onDone();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed"),
  });

  return (
    <SurfaceCard className="space-y-4 p-6" padded={false}>
      <div className="border-b border-border/40 pb-3">
        <h3 className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-muted-foreground uppercase">
          <Clock className="h-3.5 w-3.5 text-foreground" />
          Manual ETA override
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Override system calculated automated arrival time in case of traffic delays or customs holding.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-foreground">Override arrival date &amp; time</Label>
          <Input
            type="datetime-local"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
            className="rounded-xl border-border bg-muted/50 font-mono text-xs focus:bg-background"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-foreground">Reason for manual adjustment</Label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Autobahn construction detour or severe weather"
            className="rounded-xl border-border bg-muted/50 text-xs focus:bg-background"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Quick presets:</span>
          {[1, 3, 24].map((hours) => (
            <button
              key={hours}
              type="button"
              onClick={() => {
                const date = new Date();
                date.setHours(date.getHours() + hours);
                setEta(date.toISOString().slice(0, 16));
              }}
              className="rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-accent"
            >
              {hours === 24 ? "+Tomorrow" : `+${hours} Hour${hours > 1 ? "s" : ""}`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl text-xs font-bold"
            onClick={() => {
              setEta("");
              overrideEta(shipmentId, { manual_override_eta: null }).then(onDone);
            }}
          >
            Clear override
          </Button>
          <Button size="sm" className="rounded-xl text-xs font-bold" onClick={() => m.mutate()} disabled={m.isPending}>
            Save override
          </Button>
        </div>
      </div>
    </SurfaceCard>
  );
}

function LivePositionForm({ shipmentId, onDone }: { shipmentId: string; onDone: () => void }) {
  const [text, setText] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const m = useMutation({
    mutationFn: () =>
      updateLivePosition(shipmentId, {
        location_text: text,
        latitude: lat ? Number(lat) : undefined,
        longitude: lng ? Number(lng) : undefined,
        create_timeline_event: true,
      }),
    onSuccess: () => {
      toast.success("Position updated");
      setText("");
      onDone();
    },
  });

  return (
    <SurfaceCard className="mt-4">
      <SectionLabel>Quick position update</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input placeholder="Location text" value={text} onChange={(e) => setText(e.target.value)} />
        <Input placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} />
        <Input placeholder="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} />
      </div>
      <Button className="btn-accent mt-3 rounded-full" size="sm" onClick={() => m.mutate()} disabled={!text || m.isPending}>
        <MapPin className="mr-1.5 h-3.5 w-3.5" />
        Update position
      </Button>
    </SurfaceCard>
  );
}

function TimelinePanel({
  shipmentId,
  events,
  statuses,
  onDone,
  loading,
}: {
  shipmentId: string;
  events: Awaited<ReturnType<typeof fetchTimelineEvents>>["data"];
  statuses: { code: string; display_name: string }[];
  onDone: () => void;
  loading: boolean;
}) {
  const [status, setStatus] = useState("");
  const [desc, setDesc] = useState("");

  const m = useMutation({
    mutationFn: () =>
      createTimelineEvent(shipmentId, {
        status_code: status,
        description: desc || undefined,
      }),
    onSuccess: () => {
      toast.success("Event added");
      setDesc("");
      onDone();
    },
  });

  return (
    <div className="space-y-4">
      <SurfaceCard padded>
        <h3 className="mb-3 text-xs font-bold tracking-wider text-muted-foreground uppercase dark:text-muted-foreground">
          Log new event
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="rounded-xl border-border bg-muted/50 ">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s.code} value={s.code}>
                  {s.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Description (optional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="rounded-xl border-border bg-muted/50 "
          />
        </div>
        <Button
          className="mt-3 rounded-xl font-bold"
          size="sm"
          disabled={!status || m.isPending}
          onClick={() => m.mutate()}
        >
          Add event
        </Button>
      </SurfaceCard>

      <ActivityTimeline events={events ?? []} loading={loading} />
    </div>
  );
}

function DelaysPanel({
  shipmentId,
  delays,
  isDelayed,
  onDone,
  loading,
}: {
  shipmentId: string;
  delays: Awaited<ReturnType<typeof fetchDelays>>["data"];
  isDelayed: boolean;
  onDone: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");
  const [newEta, setNewEta] = useState("");

  const createM = useMutation({
    mutationFn: () =>
      createDelay(shipmentId, {
        reason,
        new_eta: new Date(newEta).toISOString(),
      }),
    onSuccess: () => {
      toast.success("Delay recorded");
      onDone();
    },
  });

  const clearM = useMutation({
    mutationFn: () => clearDelay(shipmentId),
    onSuccess: () => {
      toast.success("Delay cleared");
      onDone();
    },
  });

  return (
    <>
      <SurfaceCard className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Delay reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Input type="datetime-local" value={newEta} onChange={(e) => setNewEta(e.target.value)} />
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="rounded-full" disabled={!reason || !newEta || createM.isPending} onClick={() => createM.mutate()}>
            Record delay
          </Button>
          {isDelayed && (
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => clearM.mutate()}>
              Clear delay flag
            </Button>
          )}
        </div>
      </SurfaceCard>
      <SurfaceCard padded={false}>
        {loading && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>}
        <ul className="divide-y divide-border">
          {(delays ?? []).map((d) => (
            <li key={d.id} className="px-4 py-3.5">
              <div className="text-sm font-medium">{d.reason}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(d.old_eta)} → {formatDateTime(d.new_eta)}
              </div>
            </li>
          ))}
        </ul>
      </SurfaceCard>
    </>
  );
}

function LocationsPanel({
  shipmentId,
  logs,
  onDone,
  loading,
}: {
  shipmentId: string;
  logs: Awaited<ReturnType<typeof fetchLocationLogs>>["data"];
  onDone: () => void;
  loading: boolean;
}) {
  const [text, setText] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const m = useMutation({
    mutationFn: () =>
      createLocationLog(shipmentId, {
        location_text: text,
        latitude: Number(lat),
        longitude: Number(lng),
      }),
    onSuccess: () => {
      toast.success("Location logged");
      onDone();
    },
  });

  return (
    <>
      <SurfaceCard className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input placeholder="Location" value={text} onChange={(e) => setText(e.target.value)} />
          <Input placeholder="Lat" value={lat} onChange={(e) => setLat(e.target.value)} />
          <Input placeholder="Lng" value={lng} onChange={(e) => setLng(e.target.value)} />
        </div>
        <Button className="mt-3 rounded-full" size="sm" disabled={!text || !lat || !lng || m.isPending} onClick={() => m.mutate()}>
          Log position
        </Button>
      </SurfaceCard>
      <SurfaceCard padded={false}>
        {loading && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>}
        <ul className="divide-y divide-border">
          {(logs ?? []).map((l) => (
            <li key={l.id} className="flex items-center justify-between px-4 py-3.5 text-sm">
              <div>
                <div className="font-medium">{l.location_text}</div>
                <div className="text-xs text-muted-foreground">
                  {l.latitude?.toFixed(4)}, {l.longitude?.toFixed(4)} · {l.source}
                </div>
              </div>
              {l.is_current && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">Current</span>
              )}
            </li>
          ))}
        </ul>
      </SurfaceCard>
    </>
  );
}

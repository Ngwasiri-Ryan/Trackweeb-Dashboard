import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { ArrowLeft, Loader2, MapPin, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  AppShell,
  SectionLabel,
  SurfaceCard,
  WorkspaceHeader,
} from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchModes, fetchRoutes } from "@/lib/api/admin";
import {
  createShipment,
  estimateRoute,
  type CreateShipmentInput,
  type RouteEstimate,
} from "@/lib/api/shipments";
import { ApiError } from "@/lib/api/client";
import { formatDateTime, formatDurationFromHours } from "@/lib/format";

const SERVICE_TYPES = [
  { value: "standard", label: "Standard" },
  { value: "express", label: "Express" },
  { value: "economy", label: "Economy" },
  { value: "priority", label: "Priority" },
] as const;

export default function NewShipmentPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const modesQ = useQuery({ queryKey: ["modes"], queryFn: fetchModes });
  const routesQ = useQuery({ queryKey: ["routes"], queryFn: () => fetchRoutes() });
  const modes = modesQ.data?.data ?? [];
  const routes = routesQ.data?.data ?? [];

  const [modeId, setModeId] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [autoTracking, setAutoTracking] = useState(true);
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [routeId, setRouteId] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [speedKmh, setSpeedKmh] = useState("");
  const [serviceType, setServiceType] = useState<string>("standard");
  const [parcelQty, setParcelQty] = useState("1");
  const [shippingDate, setShippingDate] = useState("");
  const [departTime, setDepartTime] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [notes, setNotes] = useState("");
  const [estimate, setEstimate] = useState<RouteEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const selectedMode = useMemo(
    () => modes.find((m) => m.id === modeId),
    [modes, modeId],
  );

  useEffect(() => {
    if (modes[0] && !modeId) setModeId(modes[0].id);
  }, [modes, modeId]);

  useEffect(() => {
    if (selectedMode && !speedKmh) {
      setSpeedKmh(String(selectedMode.default_speed_kmh));
    }
  }, [selectedMode, speedKmh]);

  useEffect(() => {
    if (!shippingDate) {
      const d = new Date();
      setShippingDate(d.toISOString().slice(0, 10));
    }
    if (!departTime) {
      const d = new Date();
      d.setHours(d.getHours() + 2);
      setDepartTime(d.toISOString().slice(0, 16));
    }
  }, [shippingDate, departTime]);

  useEffect(() => {
    if (!routeId || routeId === "none") return;
    const route = routes.find((r) => r.id === routeId);
    if (!route) return;
    setOrigin(route.origin);
    setDestination(route.destination);
    setDistanceKm(String(route.distance_km));
    setModeId(route.mode.id);
  }, [routeId, routes]);

  const runEstimate = async () => {
    if (!modeId || !origin.trim() || !destination.trim()) {
      return;
    }
    setEstimating(true);
    setEstimateError(null);
    try {
      const result = await estimateRoute({
        mode_id: modeId,
        origin: origin.trim(),
        destination: destination.trim(),
        service_type: serviceType as CreateShipmentInput["service_type"],
        speed_kmh: speedKmh ? Number(speedKmh) : undefined,
        depart_time: departTime ? new Date(departTime).toISOString() : undefined,
      });
      setEstimate(result);
      setDistanceKm(String(result.distance_km));
    } catch (err) {
      setEstimate(null);
      setEstimateError(err instanceof ApiError ? err.message : "Route estimate failed");
    } finally {
      setEstimating(false);
    }
  };

  useEffect(() => {
    if (!modeId || !origin.trim() || !destination.trim()) {
      setEstimate(null);
      setEstimateError(null);
      return;
    }
    setEstimating(true);
    const t = setTimeout(() => {
      void runEstimate();
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeId, origin, destination, serviceType, speedKmh, departTime]);

  const travelHours =
    estimate?.travel_time_hours ??
    estimate?.duration_hours ??
    (distanceKm && speedKmh ? Number(distanceKm) / Number(speedKmh) : null);

  const modeCode = selectedMode?.code ?? "road";
  const distanceSourceLabel =
    modeCode === "road"
      ? "Distance (Google Maps driving)"
      : modeCode === "rail"
        ? "Distance (Google Maps rail/transit)"
        : modeCode === "air"
          ? "Distance (great-circle, air)"
          : modeCode === "sea"
            ? "Distance (great-circle, sea)"
            : "Distance";
  const routePathLabel =
    estimate?.polyline_source === "google_directions"
      ? modeCode === "rail"
        ? "Rail / transit route"
        : "Driving route"
      : modeCode === "air"
        ? "Great-circle flight path"
        : modeCode === "sea"
          ? "Great-circle shipping lane"
          : "Great-circle path";

  const createM = useMutation({
    mutationFn: () =>
      createShipment({
        mode_id: modeId,
        tracking_code: autoTracking ? undefined : trackingCode.trim() || undefined,
        sender_name: senderName,
        sender_phone: senderPhone || undefined,
        receiver_name: receiverName,
        receiver_phone: receiverPhone || undefined,
        receiver_email: receiverEmail || undefined,
        origin: origin.trim(),
        destination: destination.trim(),
        origin_lat: estimate?.origin_lat,
        origin_lng: estimate?.origin_lng,
        dest_lat: estimate?.dest_lat,
        dest_lng: estimate?.dest_lng,
        distance_km: distanceKm ? Number(distanceKm) : undefined,
        shipping_date: shippingDate
          ? new Date(`${shippingDate}T00:00:00`).toISOString()
          : undefined,
        depart_time: new Date(departTime).toISOString(),
        weight_kg: weightKg ? Number(weightKg) : undefined,
        speed_kmh: speedKmh ? Number(speedKmh) : undefined,
        service_type: serviceType as CreateShipmentInput["service_type"],
        parcel_quantity: parcelQty ? Number(parcelQty) : 1,
        notes: notes || undefined,
        route_id: routeId && routeId !== "none" ? routeId : undefined,
      }),
    onSuccess: (shipment) => {
      qc.invalidateQueries({ queryKey: ["shipments"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "summary"] });
      toast.success(`Shipment ${shipment.tracking_code} created`);
      navigate({ to: "/shipments/$id", params: { id: shipment.id } });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Failed to create shipment");
    },
  });

  return (
    <AppShell>
      <Link
        to="/shipments"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to shipments
      </Link>

      <WorkspaceHeader
        title="New shipment"
        description="Create a shipment with route estimation, parcel details, and optional manual tracking ID."
      />

      <form
        className="space-y-6 pb-24"
        onSubmit={(e) => {
          e.preventDefault();
          createM.mutate();
        }}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <div>
              <SectionLabel>Transport</SectionLabel>
              <SurfaceCard className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Transport mode</Label>
                    <Select value={modeId} onValueChange={setModeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {modes.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Service type</Label>
                    <Select value={serviceType} onValueChange={setServiceType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_TYPES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Speed (km/h)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={speedKmh}
                      onChange={(e) => setSpeedKmh(e.target.value)}
                      placeholder="Live map dot speed"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Weight (kg)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Saved route (optional)</Label>
                    <Select value={routeId || "none"} onValueChange={setRouteId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a route or enter manually" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Manual addresses</SelectItem>
                        {routes.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.origin} → {r.destination} ({r.mode.display_name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </SurfaceCard>
            </div>

            <div>
              <SectionLabel>Tracking ID</SectionLabel>
              <SurfaceCard className="space-y-4">
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={autoTracking}
                      onChange={() => setAutoTracking(true)}
                    />
                    Auto-generate
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={!autoTracking}
                      onChange={() => setAutoTracking(false)}
                    />
                    Enter manually
                  </label>
                </div>
                {!autoTracking && (
                  <div className="space-y-2">
                    <Label>Tracking code</Label>
                    <Input
                      value={trackingCode}
                      onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                      placeholder="TRK-2026-L-000042 or custom code"
                    />
                  </div>
                )}
              </SurfaceCard>
            </div>

            <div>
              <SectionLabel>Parties</SectionLabel>
              <SurfaceCard className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Sender name</Label>
                    <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Sender phone</Label>
                    <Input value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Receiver name</Label>
                    <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Receiver phone</Label>
                    <Input value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Client email</Label>
                    <Input
                      type="email"
                      value={receiverEmail}
                      onChange={(e) => setReceiverEmail(e.target.value)}
                      placeholder="Notifications sent on status changes"
                    />
                  </div>
                </div>
              </SurfaceCard>
            </div>
          </div>

          <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            <div>
              <SectionLabel>Route</SectionLabel>
              <SurfaceCard className="space-y-4">
                <div className="space-y-2">
                  <Label>Sender location (origin)</Label>
                  <Input value={origin} onChange={(e) => setOrigin(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Receiver location (destination)</Label>
                  <Input value={destination} onChange={(e) => setDestination(e.target.value)} required />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={estimating}
                    onClick={() => void runEstimate()}
                  >
                    {estimating ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Refresh route estimate
                  </Button>
                  {estimating && (
                    <span className="text-xs text-muted-foreground">Calculating route…</span>
                  )}
                </div>
                {estimateError && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {estimateError}
                  </p>
                )}
                {(estimate || estimating) && (
                  <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-4 text-sm dark:bg-accent/10">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                      <MapPin className="h-4 w-4 text-accent" />
                      {estimating && !estimate ? "Fetching route…" : "Live route estimate"}
                    </div>
                    {estimate && (
                      <>
                        <dl className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <dt className="text-muted-foreground">{distanceSourceLabel}</dt>
                            <dd className="text-lg font-bold">{estimate.distance_km} km</dd>
                            <dd className="text-[10px] text-muted-foreground uppercase">
                              {routePathLabel} · {estimate.polyline_points} points
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Travel time (v = d ÷ t)</dt>
                            <dd className="text-lg font-bold">
                              {formatDurationFromHours(travelHours)}
                            </dd>
                            <dd className="text-[10px] text-muted-foreground">
                              {estimate.distance_km} km ÷ {speedKmh || estimate.suggested_speed_kmh}{" "}
                              km/h
                            </dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="text-muted-foreground">Estimated arrival</dt>
                            <dd className="font-semibold">
                              {estimate.system_calculated_eta
                                ? formatDateTime(estimate.system_calculated_eta)
                                : "Set depart time to calculate ETA"}
                            </dd>
                            {departTime && estimate.system_calculated_eta && (
                              <dd className="mt-1 text-xs text-muted-foreground">
                                Depart {formatDateTime(new Date(departTime).toISOString())} → arrive{" "}
                                {formatDateTime(estimate.system_calculated_eta)}
                              </dd>
                            )}
                          </div>
                        </dl>
                      </>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Distance (km)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                    placeholder={estimating ? "Calculating…" : "Auto-filled from route estimate"}
                  />
                </div>
              </SurfaceCard>
            </div>

            <div>
              <SectionLabel>Parcel & schedule</SectionLabel>
              <SurfaceCard className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Parcel quantity</Label>
                    <Input
                      type="number"
                      min={1}
                      value={parcelQty}
                      onChange={(e) => setParcelQty(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Shipping date</Label>
                    <Input
                      type="date"
                      value={shippingDate}
                      onChange={(e) => setShippingDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Depart time</Label>
                    <Input
                      type="datetime-local"
                      value={departTime}
                      onChange={(e) => setDepartTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                </div>
              </SurfaceCard>
            </div>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/90">
          <div className="mx-auto flex max-w-[1520px] flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 text-sm text-muted-foreground">
              {estimating && !estimate ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Estimating route…
                </span>
              ) : estimate ? (
                <span>
                  <span className="font-semibold text-foreground">{estimate.distance_km} km</span>
                  {" · "}
                  {formatDurationFromHours(travelHours)} at {speedKmh || estimate.suggested_speed_kmh} km/h
                  {" · "}
                  ETA{" "}
                  {estimate.system_calculated_eta ? formatDateTime(estimate.system_calculated_eta) : "—"}
                </span>
              ) : (
                "Enter origin & destination — distance and ETA update automatically"
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="rounded-full" asChild>
                <Link to="/shipments">Cancel</Link>
              </Button>
              <Button type="submit" className="btn-accent rounded-full" disabled={createM.isPending}>
                {createM.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create shipment"
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </AppShell>
  );
}

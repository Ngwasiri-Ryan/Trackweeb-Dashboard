import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
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
import { fetchShipment, updateShipment } from "@/lib/api/shipments";
import { ApiError } from "@/lib/api/client";

const SERVICE_TYPES = [
  { value: "standard", label: "Standard" },
  { value: "express", label: "Express" },
  { value: "economy", label: "Economy" },
  { value: "priority", label: "Priority" },
] as const;

/** Convert ISO timestamp to value for `<input type="datetime-local" />` */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditShipmentPage() {
  const { id: routeId } = useParams();
  const id = routeId!;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const shipmentQ = useQuery({
    queryKey: ["shipment", id],
    queryFn: () => fetchShipment(id),
    retry: 1,
  });

  const [initialized, setInitialized] = useState(false);
  const [receiverName, setReceiverName] = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [speedKmh, setSpeedKmh] = useState("");
  const [serviceType, setServiceType] = useState("standard");
  const [parcelQty, setParcelQty] = useState("1");
  const [shippingDate, setShippingDate] = useState("");
  const [departTime, setDepartTime] = useState("");
  const [notes, setNotes] = useState("");

  const s = shipmentQ.data;

  useEffect(() => {
    if (!s || initialized) return;
    setReceiverName(s.receiver_name);
    setReceiverEmail(s.receiver_email ?? "");
    setReceiverPhone(s.receiver_phone ?? "");
    setSenderName(s.sender_name);
    setSenderPhone(s.sender_phone ?? "");
    setOrigin(s.origin);
    setDestination(s.destination);
    setDistanceKm(s.distance_km != null ? String(s.distance_km) : "");
    setWeightKg(s.weight_kg != null ? String(s.weight_kg) : "");
    setSpeedKmh(s.speed_kmh != null ? String(s.speed_kmh) : "");
    setServiceType(s.service_type ?? "standard");
    setParcelQty(String(s.parcel_quantity ?? 1));
    setShippingDate(s.shipping_date?.slice(0, 10) ?? s.depart_time.slice(0, 10));
    setDepartTime(toDatetimeLocalValue(s.depart_time));
    setNotes(s.notes ?? "");
    setInitialized(true);
  }, [s, initialized]);

  const saveM = useMutation({
    mutationFn: () => {
      if (!departTime) throw new Error("Depart time is required");
      const parsedDepart = new Date(departTime);
      if (Number.isNaN(parsedDepart.getTime())) throw new Error("Invalid depart time");

      return updateShipment(id, {
        receiver_name: receiverName,
        receiver_email: receiverEmail || undefined,
        receiver_phone: receiverPhone || undefined,
        sender_name: senderName,
        sender_phone: senderPhone || undefined,
        origin,
        destination,
        distance_km: distanceKm ? Number(distanceKm) : undefined,
        weight_kg: weightKg ? Number(weightKg) : undefined,
        speed_kmh: speedKmh ? Number(speedKmh) : undefined,
        service_type: serviceType as "standard" | "express" | "economy" | "priority",
        parcel_quantity: parcelQty ? Number(parcelQty) : undefined,
        shipping_date: shippingDate
          ? new Date(`${shippingDate}T00:00:00`).toISOString()
          : undefined,
        depart_time: parsedDepart.toISOString(),
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Shipment updated");
      qc.invalidateQueries({ queryKey: ["shipment", id] });
      qc.invalidateQueries({ queryKey: ["shipments"] });
      navigate({ to: "/shipments/$id", params: { id } });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed");
    },
  });

  if (shipmentQ.isLoading) {
    return (
      <AppShell>
        <p className="py-20 text-center text-muted-foreground">Loading shipment…</p>
      </AppShell>
    );
  }

  if (shipmentQ.isError || !s) {
    return (
      <AppShell>
        <p className="py-20 text-center text-muted-foreground">
          {shipmentQ.isError ? "Could not load shipment" : "Shipment not found"}
        </p>
        <div className="text-center">
          <Button variant="outline" className="rounded-full" asChild>
            <Link to="/shipments">Back to list</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link
        to="/shipments/$id"
        params={{ id }}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to shipment
      </Link>

      <WorkspaceHeader
        title={`Edit ${s.tracking_code}`}
        description="Update parties, route, parcel details, and client contact."
      />

      <form
        className="grid gap-6 lg:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          saveM.mutate();
        }}
      >
        <SurfaceCard className="space-y-4">
          <SectionLabel>Parties</SectionLabel>
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
                placeholder="Used for status change notifications"
              />
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <SectionLabel>Route & parcel</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Origin</Label>
              <Input value={origin} onChange={(e) => setOrigin(e.target.value)} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Destination</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Distance (km)</Label>
              <Input type="number" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Speed (km/h)</Label>
              <Input type="number" value={speedKmh} onChange={(e) => setSpeedKmh(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Service type</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Parcel quantity</Label>
              <Input type="number" min={1} value={parcelQty} onChange={(e) => setParcelQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Shipping date</Label>
              <Input type="date" value={shippingDate} onChange={(e) => setShippingDate(e.target.value)} />
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
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </div>
        </SurfaceCard>

        <div className="flex gap-3 lg:col-span-2">
          <Button type="submit" className="btn-accent rounded-full" disabled={saveM.isPending}>
            {saveM.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
          <Button type="button" variant="outline" className="rounded-full" asChild>
            <Link to="/shipments/$id" params={{ id }}>Cancel</Link>
          </Button>
        </div>
      </form>
    </AppShell>
  );
}

import { lazy, Suspense } from "react";
import type { LiveMapItem } from "@/lib/types";

const AdminLiveMapInner = lazy(() =>
  import("./live-map").then((m) => ({ default: m.AdminLiveMap })),
);

const ShipmentLiveMapInner = lazy(() =>
  import("./live-map").then((m) => ({ default: m.ShipmentLiveMap })),
);

function MapFallback({ height = "420px" }: { height?: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-border bg-muted/20 text-sm text-muted-foreground"
      style={{ height }}
    >
      Loading map…
    </div>
  );
}

export function AdminLiveMap(props: {
  items: LiveMapItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  height?: string;
}) {
  return (
    <Suspense fallback={<MapFallback height={props.height} />}>
      <AdminLiveMapInner {...props} />
    </Suspense>
  );
}

type ShipmentLiveMapProps = {
  origin: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number; label: string };
  current: { lat: number; lng: number; label: string | null };
  geopath?: { lat: number; lng: number }[];
  height?: string;
  modeCode?: string;
  polylineSource?: "google_directions" | "great_circle" | "manual";
  status?: string;
  departTime?: string;
  speedKmh?: number;
  animate?: boolean;
  progressPercent?: number;
  isDelayed?: boolean;
  motion?: {
    is_moving: boolean;
    is_delayed?: boolean;
    position_source: "simulated" | "manual" | "delayed";
    remaining_hours?: number | null;
  };
};

export function ShipmentLiveMap(props: ShipmentLiveMapProps) {
  return (
    <Suspense fallback={<MapFallback height={props.height} />}>
      <ShipmentLiveMapInner {...props} />
    </Suspense>
  );
}

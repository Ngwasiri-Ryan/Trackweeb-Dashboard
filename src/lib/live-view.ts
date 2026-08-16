/** Raw response from GET /shipments/:id/live */
export type ShipmentLiveApiResponse = {
  shipment: {
    id: string;
    tracking_code: string;
    status: string;
    is_delayed: boolean;
    progress_percent: number;
    [key: string]: unknown;
  };
  route: {
    origin: MapPoint;
    destination: MapPoint;
    current: { lat: number; lng: number; label: string | null };
  };
  map: {
    origin: MapPoint;
    destination: MapPoint;
    simulated_position: { lat: number; lng: number; label: string | null };
    polyline: [number, number][];
    polyline_source?: "google_directions" | "great_circle" | "manual";
    progress_percent: number;
    distance_km?: number;
    motion?: {
      is_moving?: boolean;
      is_delayed?: boolean;
      heading_degrees?: number | null;
      speed_kmh?: number | null;
      poll_interval_seconds?: number;
      position_source?: "simulated" | "manual" | "delayed";
      remaining_hours?: number | null;
    };
  };
  location_trail: unknown[];
  recent_events: unknown[];
  latest_delay: unknown | null;
  estimated_arrival: string;
};

export type MapPoint = {
  lat: number;
  lng: number;
  label: string;
  marker?: string;
};

/** Normalized shape for map components */
export type ShipmentLiveView = {
  origin: MapPoint;
  destination: MapPoint;
  current: { lat: number; lng: number; label: string | null };
  geopath: { lat: number; lng: number }[];
  progress_percent: number;
  poll_interval_seconds: number;
  polyline_source: "google_directions" | "great_circle" | "manual";
  distance_km?: number;
  mode_code: string;
  status: string;
  depart_time: string;
  speed_kmh: number;
  is_delayed: boolean;
  motion: {
    is_moving: boolean;
    is_delayed: boolean;
    heading_degrees: number | null;
    speed_kmh: number;
    position_source: "simulated" | "manual" | "delayed";
    remaining_hours: number | null;
  };
};

export function normalizeShipmentLive(raw: ShipmentLiveApiResponse): ShipmentLiveView {
  const map = raw.map ?? ({} as ShipmentLiveApiResponse["map"]);
  const route = raw.route ?? ({} as ShipmentLiveApiResponse["route"]);

  const origin = map.origin ?? route.origin ?? fallbackPoint(0, 0, "Origin");
  const destination = map.destination ?? route.destination ?? fallbackPoint(0, 0, "Destination");
  const current =
    map.simulated_position ??
    route.current ??
    ({ lat: origin.lat, lng: origin.lng, label: origin.label } as const);

  const polyline = map.polyline ?? [];
  const geopath =
    polyline.length > 0
      ? polyline.map(([lat, lng]) => ({ lat, lng }))
      : [
          { lat: origin.lat, lng: origin.lng },
          { lat: current.lat, lng: current.lng },
          { lat: destination.lat, lng: destination.lng },
        ];

  const isDelayed = raw.shipment.is_delayed ?? map.motion?.is_delayed ?? false;

  return {
    origin,
    destination,
    current,
    geopath,
    progress_percent:
      map.progress_percent ?? raw.shipment.progress_percent ?? 0,
    poll_interval_seconds: map.motion?.poll_interval_seconds ?? 30,
    polyline_source: map.polyline_source ?? "great_circle",
    distance_km: map.distance_km ?? (raw.shipment.distance_km as number | undefined),
    mode_code: (raw.shipment.mode as { code?: string } | undefined)?.code ?? "road",
    status: raw.shipment.status ?? "booked",
    depart_time: (raw.shipment.depart_time as string) ?? new Date().toISOString(),
    speed_kmh:
      map.motion?.speed_kmh ??
      (raw.shipment.speed_kmh as number | undefined) ??
      80,
    is_delayed: isDelayed,
    motion: {
      is_moving: map.motion?.is_moving ?? raw.shipment.status === "in_transit",
      is_delayed: isDelayed,
      heading_degrees: map.motion?.heading_degrees ?? null,
      speed_kmh: map.motion?.speed_kmh ?? (raw.shipment.speed_kmh as number) ?? 80,
      position_source: map.motion?.position_source ?? "simulated",
      remaining_hours: map.motion?.remaining_hours ?? null,
    },
  };
}

function fallbackPoint(lat: number, lng: number, label: string): MapPoint {
  return { lat, lng, label };
}

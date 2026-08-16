import { hoursUntilEta, speedBasedProgress } from "./eta";
import {
  extractPolylinePoints,
  headingDegrees,
  polylineDistanceKm,
  positionOnPolyline,
  type LatLng,
} from "./geopath";
import type { Mode, ShipmentRow } from "./types";

export function finalEta(shipment: ShipmentRow): Date {
  return new Date(shipment.manual_override_eta ?? shipment.system_calculated_eta);
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  return Number(v);
}

export function buildLiveView(shipment: ShipmentRow & { modes: Mode }) {
  const points = extractPolylinePoints(shipment.route_polyline);
  const eta = finalEta(shipment);
  const progress = resolveProgress(shipment, points);
  const originLat = num(shipment.origin_lat) ?? points[0]?.[0] ?? 0;
  const originLng = num(shipment.origin_lng) ?? points[0]?.[1] ?? 0;
  const destLat = num(shipment.dest_lat) ?? points.at(-1)?.[0] ?? 0;
  const destLng = num(shipment.dest_lng) ?? points.at(-1)?.[1] ?? 0;
  const simulated = resolvePosition(shipment, points, progress);
  const motion = buildMotion(shipment, points, progress, simulated, eta);
  const allPoints: LatLng[] =
    points.length > 0
      ? points
      : [
          [originLat, originLng],
          [destLat, destLng],
        ];

  return {
    origin: { lat: originLat, lng: originLng, label: shipment.origin },
    destination: { lat: destLat, lng: destLng, label: shipment.destination },
    polyline: allPoints,
    polyline_source: shipment.route_polyline_source,
    distance_km: num(shipment.distance_km) ?? polylineDistanceKm(allPoints),
    simulated_position: simulated,
    progress_percent: Math.round(progress * 100),
    motion,
    estimated_arrival: eta.toISOString(),
    is_delayed: shipment.is_delayed,
  };
}

function pauseState(shipment: ShipmentRow) {
  return {
    isDelayed: shipment.is_delayed,
    pausedProgress: num(shipment.delay_paused_progress),
    pauseTotalMs: shipment.delay_pause_total_ms ?? 0,
  };
}

function resolveProgress(shipment: ShipmentRow & { modes: Mode }, points: LatLng[]): number {
  if (points.length < 2) return 0;
  const totalKm = polylineDistanceKm(points);
  const speed = num(shipment.speed_kmh) ?? num(shipment.modes.default_speed_kmh) ?? 80;
  return speedBasedProgress(
    new Date(shipment.depart_time),
    speed,
    totalKm,
    new Date(),
    shipment.status,
    pauseState(shipment),
  );
}

export function currentProgress(shipment: ShipmentRow & { modes: Mode }): number {
  const points = extractPolylinePoints(shipment.route_polyline);
  return resolveProgress(shipment, points);
}

function resolvePosition(shipment: ShipmentRow, points: LatLng[], progress: number) {
  if (shipment.status === "delivered") {
    return {
      lat: num(shipment.dest_lat) ?? points.at(-1)?.[0] ?? 0,
      lng: num(shipment.dest_lng) ?? points.at(-1)?.[1] ?? 0,
      label: shipment.destination,
    };
  }
  if (shipment.status === "booked") {
    return {
      lat: num(shipment.origin_lat) ?? points[0]?.[0] ?? 0,
      lng: num(shipment.origin_lng) ?? points[0]?.[1] ?? 0,
      label: shipment.origin,
    };
  }
  if (
    shipment.use_manual_position &&
    !shipment.is_delayed &&
    shipment.current_location_lat != null &&
    shipment.current_location_lng != null
  ) {
    return {
      lat: num(shipment.current_location_lat)!,
      lng: num(shipment.current_location_lng)!,
      label: shipment.current_location_text,
    };
  }
  if (points.length >= 2) {
    const [lat, lng] = positionOnPolyline(points, progress);
    return {
      lat,
      lng,
      label: shipment.is_delayed
        ? (shipment.current_location_text ?? "Delayed — holding position")
        : (shipment.current_location_text ?? "In transit"),
    };
  }
  return {
    lat: num(shipment.origin_lat) ?? 0,
    lng: num(shipment.origin_lng) ?? 0,
    label: shipment.current_location_text,
  };
}

function buildMotion(
  shipment: ShipmentRow & { modes: Mode },
  points: LatLng[],
  progress: number,
  _simulated: { lat: number; lng: number },
  eta: Date,
) {
  const isDelayed = shipment.is_delayed;
  const isMoving =
    !isDelayed &&
    shipment.status !== "delivered" &&
    shipment.status !== "booked" &&
    progress < 1 &&
    !shipment.use_manual_position;

  let heading: number | null = null;
  if (points.length >= 2 && isMoving) {
    const idx = Math.min(points.length - 2, Math.floor(progress * (points.length - 1)));
    heading = headingDegrees(points[idx], points[idx + 1]);
  }

  const remainingHours = progress < 1 ? hoursUntilEta(eta) : 0;

  return {
    is_moving: isMoving,
    is_delayed: isDelayed,
    heading_degrees: heading,
    speed_kmh: num(shipment.speed_kmh) ?? num(shipment.modes.default_speed_kmh),
    poll_interval_seconds: 30,
    position_source: isDelayed ? "delayed" : shipment.use_manual_position ? "manual" : "simulated",
    remaining_hours: remainingHours > 0 ? Math.round(remainingHours * 100) / 100 : null,
  } as const;
}

import { useEffect, useMemo, useState } from "react";

export type RoutePoint = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function polylineDistanceKm(points: RoutePoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineKm(points[i]!, points[i + 1]!);
  }
  return total;
}

/** Position at 0–1 progress along a polyline (by distance). */
export function positionOnPolyline(points: RoutePoint[], progress: number): RoutePoint {
  const p = Math.max(0, Math.min(1, progress));
  if (points.length === 0) return { lat: 0, lng: 0 };
  if (p === 0) return points[0]!;
  if (p === 1) return points.at(-1)!;

  const segmentLengths = points.slice(0, -1).map((pt, i) => haversineKm(pt, points[i + 1]!));
  const total = segmentLengths.reduce((a, b) => a + b, 0);
  if (total === 0) return points[0]!;

  const target = total * p;
  let walked = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const segLen = segmentLengths[i]!;
    if (walked + segLen >= target) {
      const t = (target - walked) / segLen;
      const from = points[i]!;
      const to = points[i + 1]!;
      return {
        lat: from.lat + (to.lat - from.lat) * t,
        lng: from.lng + (to.lng - from.lng) * t,
      };
    }
    walked += segLen;
  }

  return points.at(-1)!;
}

export function headingOnPolyline(points: RoutePoint[], progress: number): number | null {
  if (points.length < 2) return null;
  const p = Math.max(0, Math.min(1, progress));
  const idx = Math.min(points.length - 2, Math.floor(p * (points.length - 1)));
  const from = points[idx]!;
  const to = points[idx + 1]!;
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** When shipment has left the hub, don't wait for a future depart_time to start motion. */
export function effectiveDepartTime(
  status: string,
  departTime: string | Date,
  now = Date.now(),
): Date {
  const depart = new Date(departTime);
  const active =
    status === "departed" ||
    status === "in_transit" ||
    status === "arrived";

  if (active && depart.getTime() > now) {
    return new Date(now);
  }

  return depart;
}

export function speedBasedProgress(
  departTime: string | Date,
  speedKmh: number,
  totalDistanceKm: number,
  now = Date.now(),
  status?: string,
  pause?: {
    isDelayed: boolean;
    pausedProgress: number | null;
    pauseTotalMs: number;
  },
): number {
  if (
    pause?.isDelayed &&
    pause.pausedProgress !== null &&
    pause.pausedProgress !== undefined
  ) {
    return Math.max(0, Math.min(1, pause.pausedProgress));
  }

  if (totalDistanceKm <= 0 || speedKmh <= 0) return 0;
  const depart = status
    ? effectiveDepartTime(status, departTime, now)
    : new Date(departTime);
  const departMs = depart.getTime();
  const pauseMs = pause?.pauseTotalMs ?? 0;
  const elapsedMs = Math.max(0, now - departMs - pauseMs);
  const traveledKm = speedKmh * (elapsedMs / 3_600_000);
  return Math.max(0, Math.min(1, traveledKm / totalDistanceKm));
}

/** Extra route progress per second on top of shipment speed (0.17% / sec). */
export const ROUTE_VISUAL_PROGRESS_PER_SEC = 0.0017;

export type RouteMotionInput = {
  geopath: RoutePoint[];
  departTime: string;
  speedKmh: number;
  status: string;
  isMoving: boolean;
  isDelayed?: boolean;
  pausedProgress?: number | null;
  pauseTotalMs?: number;
  positionSource: "simulated" | "manual" | "delayed";
  manualPosition?: RoutePoint | null;
  serverPosition?: RoutePoint | null;
  viewStartTime?: number;
  visualProgressPerSec?: number;
};

export function computeRouteMotion(
  input: RouteMotionInput,
  now = Date.now(),
): { position: RoutePoint; progress: number; heading: number | null } {
  const { geopath, departTime, speedKmh, status, isMoving, isDelayed, positionSource, manualPosition } =
    input;

  if (isDelayed && input.pausedProgress != null) {
    const position = positionOnPolyline(geopath, input.pausedProgress);
    return {
      position,
      progress: input.pausedProgress,
      heading: null,
    };
  }

  if (status === "delivered" && geopath.length > 0) {
    const dest = geopath.at(-1)!;
    return { position: dest, progress: 1, heading: null };
  }

  if (status === "booked" && geopath.length > 0) {
    const origin = geopath[0]!;
    return { position: origin, progress: 0, heading: null };
  }

  // departed / in_transit / arrived — always simulate along route when moving
  if (positionSource === "manual" && manualPosition) {
    return { position: manualPosition, progress: 0, heading: null };
  }

  if (!isMoving || geopath.length < 2) {
    const fallback = geopath[0] ?? { lat: 0, lng: 0 };
    return { position: fallback, progress: 0, heading: null };
  }

  const pause = {
    isDelayed: isDelayed ?? false,
    pausedProgress: input.pausedProgress ?? null,
    pauseTotalMs: input.pauseTotalMs ?? 0,
  };

  const totalKm = polylineDistanceKm(geopath);
  const realProgress = speedBasedProgress(
    departTime,
    speedKmh,
    totalKm,
    now,
    status,
    pause,
  );

  const visualRate =
    isDelayed || positionSource === "delayed"
      ? 0
      : (input.visualProgressPerSec ?? ROUTE_VISUAL_PROGRESS_PER_SEC);
  const viewBoost =
    input.viewStartTime != null && visualRate > 0
      ? ((now - input.viewStartTime) / 1000) * visualRate
      : 0;
  const progress = Math.min(0.995, realProgress + viewBoost);

  const position = positionOnPolyline(geopath, progress);
  const heading = headingOnPolyline(geopath, progress);

  return { position, progress, heading };
}

/** Real-time position along route at shipment speed (requestAnimationFrame). */
export function useAnimatedRoutePosition(input: RouteMotionInput | null) {
  const totalKm = useMemo(
    () => (input?.geopath.length ? polylineDistanceKm(input.geopath) : 0),
    [input?.geopath],
  );

  const [motion, setMotion] = useState(() =>
    input ? computeRouteMotion(input) : { position: { lat: 0, lng: 0 }, progress: 0, heading: null },
  );

  useEffect(() => {
    if (!input) return;

    let raf = 0;

    const tick = () => {
      setMotion(computeRouteMotion(input));
      raf = requestAnimationFrame(tick);
    };

    setMotion(computeRouteMotion(input));
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    input?.geopath,
    input?.departTime,
    input?.speedKmh,
    input?.status,
    input?.isMoving,
    input?.isDelayed,
    input?.pausedProgress,
    input?.pauseTotalMs,
    input?.positionSource,
    input?.manualPosition?.lat,
    input?.manualPosition?.lng,
    input?.viewStartTime,
    input?.visualProgressPerSec,
    totalKm,
  ]);

  return motion;
}

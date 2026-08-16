import type { Mode, ModeCode, ServiceType } from "./types";

export interface EtaBreakdown {
  travel_hours: number;
  rest_break_hours: number;
  handling_hours_origin: number;
  handling_hours_dest: number;
  service_multiplier: number;
  total_hours: number;
}

const SERVICE_MULTIPLIERS: Record<ServiceType, number> = {
  standard: 1,
  express: 0.75,
  economy: 1.25,
  priority: 0.6,
};

export function calculateSystemEta(
  mode: Mode,
  distanceKm: number,
  departTime: Date,
  options?: { speedKmh?: number | null; serviceType?: ServiceType },
): { eta: Date; breakdown: EtaBreakdown } {
  const modeCode = mode.code as ModeCode;
  const handlingOrigin = mode.handling_hours_origin;
  const handlingDest = mode.handling_hours_dest;
  const restPerKm = Number(mode.rest_break_hours_per_km) || 0;
  const modeSpeed = Number(mode.default_speed_kmh) || 80;
  const speedKmh = options?.speedKmh ?? modeSpeed;
  const serviceMultiplier = SERVICE_MULTIPLIERS[options?.serviceType ?? "standard"];

  let travelHours = speedKmh > 0 ? distanceKm / speedKmh : 0;
  let restBreakHours = 0;

  switch (modeCode) {
    case "road":
      restBreakHours = distanceKm * restPerKm;
      break;
    case "rail":
      restBreakHours = distanceKm * (restPerKm || 0.00005);
      break;
    case "air":
      restBreakHours = 0;
      break;
    case "sea":
      if (!options?.speedKmh) travelHours = (distanceKm / 1.852) / 15;
      restBreakHours = distanceKm * (restPerKm || 0.002);
      break;
  }

  const baseHours =
    travelHours +
    restBreakHours +
    handlingOrigin +
    handlingDest +
    (modeCode === "sea" ? 48 - handlingOrigin - handlingDest : 0);

  const totalHours = baseHours * serviceMultiplier;
  const eta = new Date(departTime.getTime() + totalHours * 3600 * 1000);

  return {
    eta,
    breakdown: {
      travel_hours: round2(travelHours),
      rest_break_hours: round2(restBreakHours),
      handling_hours_origin: handlingOrigin,
      handling_hours_dest: handlingDest,
      service_multiplier: serviceMultiplier,
      total_hours: round2(totalHours),
    },
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function effectiveDepartTime(departTime: Date, status: string, now = new Date()): Date {
  const active = status === "departed" || status === "in_transit" || status === "arrived";
  if (active && departTime.getTime() > now.getTime()) return now;
  return departTime;
}

export function speedBasedProgress(
  departTime: Date,
  speedKmh: number,
  totalDistanceKm: number,
  now = new Date(),
  status?: string,
  pause?: { isDelayed: boolean; pausedProgress: number | null; pauseTotalMs: number },
): number {
  if (pause?.isDelayed && pause.pausedProgress != null) {
    return Math.max(0, Math.min(1, pause.pausedProgress));
  }
  if (totalDistanceKm <= 0 || speedKmh <= 0) return 0;
  const depart = status ? effectiveDepartTime(departTime, status, now) : departTime;
  const pauseMs = pause?.pauseTotalMs ?? 0;
  const elapsedMs = Math.max(0, now.getTime() - depart.getTime() - pauseMs);
  const traveledKm = speedKmh * (elapsedMs / 3_600_000);
  return Math.max(0, Math.min(1, traveledKm / totalDistanceKm));
}

export function travelEtaFromSpeed(departTime: Date, distanceKm: number, speedKmh: number): Date {
  const hours = distanceKm / speedKmh;
  return new Date(departTime.getTime() + hours * 3_600_000);
}

export function hoursUntilEta(eta: Date, now = new Date()): number {
  return Math.max(0, (eta.getTime() - now.getTime()) / 3_600_000);
}

export function hoursOverdue(finalEtaDate: Date, now = new Date()): number {
  return Math.max(0, Math.round((now.getTime() - finalEtaDate.getTime()) / 3600000));
}

export function progressPercent(departTime: Date, finalEtaDate: Date, now = new Date()): number {
  const total = finalEtaDate.getTime() - departTime.getTime();
  if (total <= 0) return 100;
  const elapsed = now.getTime() - departTime.getTime();
  return Math.round(Math.max(0, Math.min(1, elapsed / total)) * 100);
}

export function suggestStatusFromProgress(
  currentStatus: string,
  progress: number,
  departTime: Date,
  now = new Date(),
): string | null {
  if (currentStatus === "delivered") return null;
  if (currentStatus === "booked" && departTime.getTime() <= now.getTime()) return "departed";
  if (progress >= 1) return "delivered";
  if (progress >= 0.97) return "arrived";
  if (progress >= 0.05 && (currentStatus === "booked" || currentStatus === "departed")) return "in_transit";
  if (progress > 0 && currentStatus === "booked" && departTime.getTime() <= now.getTime()) return "departed";
  return null;
}

export function previewEta(
  mode: Mode,
  distanceKm: number,
  departTime: string,
  speedKmh?: number | null,
  serviceType?: ServiceType,
) {
  return calculateSystemEta(mode, distanceKm, new Date(departTime), { speedKmh, serviceType });
}

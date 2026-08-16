import { buildLiveView, currentProgress, finalEta } from "./live-tracking";
import { hoursOverdue, hoursUntilEta } from "./eta";
import type { Delay, Mode, ShipmentRow } from "./types";

export type ShipmentSummary = {
  id: string;
  tracking_code: string;
  receiver_name: string;
  receiver_email?: string | null;
  destination: string;
  depart_time: string;
  final_eta: string;
  status: string;
  current_location_text: string | null;
  hours_remaining?: number;
  hours_overdue?: number;
  is_delayed: boolean;
  mode: { code: string; display_name: string };
  latest_delay?: {
    id: string;
    reason: string;
    old_eta: string;
    new_eta: string;
    created_at: string;
  } | null;
};

export type Shipment = {
  id: string;
  tracking_code: string;
  customer_reference: string | null;
  mode_id: string;
  mode: { id: string; code: string; display_name: string; icon: string };
  status: string;
  receiver_name: string;
  receiver_phone: string | null;
  receiver_email: string | null;
  sender_name: string;
  sender_phone: string | null;
  origin: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination: string;
  dest_lat: number | null;
  dest_lng: number | null;
  distance_km: number | null;
  shipping_date: string | null;
  depart_time: string;
  weight_kg: number | null;
  speed_kmh: number | null;
  service_type: string;
  parcel_quantity: number;
  parcel_dimensions: { length_cm?: number; width_cm?: number; height_cm?: number } | null;
  system_calculated_eta: string;
  manual_override_eta: string | null;
  final_eta: string;
  is_delayed: boolean;
  current_location_text: string | null;
  current_location_lat: number | null;
  current_location_lng: number | null;
  progress_percent: number;
  is_archived: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

function latestDelay(delays?: Delay[]) {
  if (!delays?.length) return null;
  const d = delays[0];
  return {
    id: d.id,
    reason: d.reason,
    old_eta: d.old_eta,
    new_eta: d.new_eta,
    created_at: d.created_at,
  };
}

export function toShipmentSummary(
  row: ShipmentRow & { modes?: Mode; delays?: Delay[] },
): ShipmentSummary {
  const eta = finalEta(row);
  const mode = row.modes;
  const remaining = hoursUntilEta(eta);
  const overdue = hoursOverdue(eta);
  return {
    id: row.id,
    tracking_code: row.tracking_code,
    receiver_name: row.receiver_name,
    receiver_email: row.receiver_email,
    destination: row.destination,
    depart_time: row.depart_time,
    final_eta: eta.toISOString(),
    status: row.status,
    current_location_text: row.current_location_text,
    hours_remaining: remaining > 0 ? remaining : undefined,
    hours_overdue: overdue > 0 ? overdue : undefined,
    is_delayed: row.is_delayed,
    mode: {
      code: mode?.code ?? "road",
      display_name: mode?.display_name ?? "Road",
    },
    latest_delay: latestDelay(row.delays),
  };
}

export function toShipment(row: ShipmentRow & { modes?: Mode }): Shipment {
  const mode = row.modes;
  const eta = finalEta(row);
  const progress = currentProgress({ ...row, modes: row.modes ?? ({ code: "road" } as Mode) });
  return {
    id: row.id,
    tracking_code: row.tracking_code,
    customer_reference: row.customer_reference,
    mode_id: row.mode_id,
    mode: {
      id: mode?.id ?? row.mode_id,
      code: mode?.code ?? "road",
      display_name: mode?.display_name ?? "Road",
      icon: mode?.icon ?? "truck",
    },
    status: row.status,
    receiver_name: row.receiver_name,
    receiver_phone: row.receiver_phone,
    receiver_email: row.receiver_email,
    sender_name: row.sender_name,
    sender_phone: row.sender_phone,
    origin: row.origin,
    origin_lat: row.origin_lat,
    origin_lng: row.origin_lng,
    destination: row.destination,
    dest_lat: row.dest_lat,
    dest_lng: row.dest_lng,
    distance_km: row.distance_km,
    shipping_date: row.shipping_date,
    depart_time: row.depart_time,
    weight_kg: row.weight_kg,
    speed_kmh: row.speed_kmh,
    service_type: row.service_type,
    parcel_quantity: row.parcel_quantity,
    parcel_dimensions: (row.parcel_dimensions as Shipment["parcel_dimensions"]) ?? null,
    system_calculated_eta: row.system_calculated_eta,
    manual_override_eta: row.manual_override_eta,
    final_eta: eta.toISOString(),
    is_delayed: row.is_delayed,
    current_location_text: row.current_location_text,
    current_location_lat: row.current_location_lat,
    current_location_lng: row.current_location_lng,
    progress_percent: Math.round(progress * 100),
    is_archived: row.is_archived,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function toLiveMapItem(row: ShipmentRow & { modes?: Mode }) {
  const live = buildLiveView({ ...row, modes: row.modes ?? ({ code: "road", display_name: "Road" } as Mode) });
  const eta = finalEta(row);
  const mode = row.modes;
  return {
    id: row.id,
    tracking_code: row.tracking_code,
    status: row.status,
    is_delayed: row.is_delayed,
    receiver_name: row.receiver_name,
    origin: row.origin,
    origin_lat: live.origin.lat,
    origin_lng: live.origin.lng,
    destination: row.destination,
    dest_lat: live.destination.lat,
    dest_lng: live.destination.lng,
    current_location_text: row.current_location_text,
    current_location_lat: live.simulated_position.lat,
    current_location_lng: live.simulated_position.lng,
    final_eta: eta.toISOString(),
    depart_time: row.depart_time,
    mode: {
      code: mode?.code ?? "road",
      display_name: mode?.display_name ?? "Road",
      icon: mode?.icon ?? "truck",
    },
    progress_percent: live.progress_percent,
  };
}

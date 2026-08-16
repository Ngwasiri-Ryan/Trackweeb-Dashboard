import {
  archiveShipment as archiveShipmentDb,
  createShipment as createShipmentDb,
  estimateRoutePreview,
  getShipment,
  getShipmentByCode,
  getShipmentFull,
  getShipmentLive,
  listShipments,
  overrideEta as overrideEtaDb,
  recordDelay,
  recalculateEta as recalculateEtaDb,
  restoreShipment,
  updateShipment as updateShipmentDb,
  updateStatus,
  addLocationLog,
  addTimelineEvent,
} from "../shipments-service";
import { sendDelayEmail, sendStatusChangeEmail } from "../notifications";
import { requireProfile, supabase } from "../supabase";
import { generateBarcodeBlob } from "../barcode";
import { buildReceiptHtml } from "../receipt";
import { toShipment, toShipmentSummary } from "../shipment-mapper";
import { normalizeShipmentLive, type ShipmentLiveApiResponse } from "../live-view";
import { ApiError, downloadBlob } from "./client";
import type { Paginated } from "./dashboard";
import type { ShipmentSummary } from "../shipment-mapper";
import type { Delay } from "../types";

export type ShipmentListParams = {
  status?: string;
  mode_id?: string;
  is_delayed?: boolean;
  is_archived?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
};

export function fetchShipments(params: ShipmentListParams = {}) {
  return listShipments({
    search: params.search,
    status: params.status,
    mode_id: params.mode_id,
    is_delayed: params.is_delayed,
    isArchived: params.is_archived,
    page: params.page,
    limit: params.limit,
    sort: params.sort,
  }).then((res) => {
    const totalPages = Math.max(1, Math.ceil(res.total / res.limit));
    return {
      data: res.data.map((row) => {
        const delays = (row as { delays?: Delay[] }).delays;
        const sorted = delays?.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
        return toShipmentSummary({ ...row, delays: sorted });
      }),
      meta: {
        page: res.page,
        limit: res.limit,
        total: res.total,
        total_pages: totalPages,
      },
    } satisfies Paginated<ShipmentSummary>;
  });
}

export function fetchShipment(id: string) {
  return getShipment(id).then(toShipment);
}

export async function fetchShipmentFull(id: string) {
  const full = await getShipmentFull(id);
  const delays = full.delays.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  return {
    shipment: toShipment(full.shipment),
    timeline_events: full.timeline_events,
    delays: full.delays,
    location_logs: full.location_logs,
    latest_delay: delays[0] ?? null,
  };
}

export function fetchShipmentByCode(code: string) {
  return getShipmentByCode(code).then((row) => (row ? toShipment(row) : null));
}

export function downloadShipmentBarcode(_id: string, trackingCode: string) {
  return generateBarcodeBlob(trackingCode).then((blob) =>
    downloadBlob(blob, `${trackingCode}-barcode.png`),
  );
}

export async function downloadShipmentReceipt(id: string, trackingCode: string) {
  const shipment = await getShipment(id);
  const html = buildReceiptHtml(shipment);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  downloadBlob(blob, `${trackingCode}-receipt.html`);
}

export async function fetchShipmentReceiptHtml(id: string) {
  const shipment = await getShipment(id);
  return buildReceiptHtml(shipment);
}

export function shipmentBarcodeUrl(_id: string) {
  return "barcode://local";
}

export async function fetchShipmentLive(id: string) {
  const live = await getShipmentLive(id);
  const mode = live.shipment.modes!;
  const map = live.map;
  const raw: ShipmentLiveApiResponse = {
    shipment: {
      id: live.shipment.id,
      tracking_code: live.shipment.tracking_code,
      status: live.shipment.status,
      is_delayed: live.shipment.is_delayed,
      progress_percent: map.progress_percent,
    },
    route: {
      origin: map.origin,
      destination: map.destination,
      current: {
        lat: map.simulated_position.lat,
        lng: map.simulated_position.lng,
        label: map.simulated_position.label,
      },
    },
    map: {
      origin: map.origin,
      destination: map.destination,
      simulated_position: map.simulated_position,
      polyline: map.polyline.map(([lat, lng]) => [lat, lng] as [number, number]),
      polyline_source: (map.polyline_source as "google_directions" | "great_circle" | "manual") ?? "great_circle",
      progress_percent: map.progress_percent,
      distance_km: map.distance_km ?? undefined,
      motion: map.motion,
    },
    location_trail: live.location_logs,
    recent_events: live.timeline_events,
    latest_delay: live.delays[0] ?? null,
    estimated_arrival: live.estimated_arrival,
  };
  void mode;
  return normalizeShipmentLive(raw);
}

export type CreateShipmentInput = Parameters<typeof createShipmentDb>[2];

export type RouteEstimate = Awaited<ReturnType<typeof estimateRoutePreview>>;

export function estimateRoute(body: Parameters<typeof estimateRoutePreview>[0]) {
  return estimateRoutePreview(body);
}

export async function createShipment(body: CreateShipmentInput) {
  const { user, profile } = await requireProfile();
  const row = await createShipmentDb(user.id, profile.tenant_id, body);
  return toShipment(row);
}

export async function updateShipment(id: string, body: Partial<CreateShipmentInput>) {
  const { user } = await requireProfile();
  const row = await updateShipmentDb(user.id, id, body);
  return toShipment(row);
}

export function archiveShipment(id: string) {
  return archiveShipmentDb(id);
}

export async function updateShipmentStatus(
  id: string,
  body: {
    status: string;
    location_text?: string;
    location_lat?: number;
    location_lng?: number;
    description?: string;
    event_time?: string;
  },
) {
  const { user } = await requireProfile();
  const before = await getShipment(id);
  const oldStatus = before.status;
  const row = await updateStatus(user.id, id, body);

  let notification: { sent: boolean; sent_to: string | null; error: string | null } | null = null;
  if (before.receiver_email && oldStatus !== body.status) {
    const email = await sendStatusChangeEmail({
      to: before.receiver_email,
      tracking_code: before.tracking_code,
      receiver_name: before.receiver_name,
      old_status: oldStatus,
      new_status: body.status,
      origin: before.origin,
      destination: before.destination,
    });
    notification = {
      sent: email.sent,
      sent_to: email.sent ? before.receiver_email : null,
      error: email.error ?? null,
    };
  }

  return {
    shipment: toShipment(row),
    timeline_event: {
      id: "",
      shipment_id: id,
      status_code: body.status,
      location_text: body.location_text ?? null,
      location_lat: body.location_lat ?? null,
      location_lng: body.location_lng ?? null,
      description: body.description ?? null,
      is_delay_event: false,
      delay_reason: null,
      event_time: body.event_time ?? new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    notification,
  };
}

export async function recalculateEta(id: string) {
  await recalculateEtaDb(id);
  return fetchShipment(id);
}

export async function overrideEta(
  id: string,
  body: { manual_override_eta?: string | null; reason?: string },
) {
  const { user } = await requireProfile();
  const row = await overrideEtaDb(user.id, id, body.manual_override_eta ?? null, body.reason);
  return toShipment(row);
}

export async function updateLivePosition(
  id: string,
  body: {
    location_text: string;
    latitude?: number;
    longitude?: number;
    source?: string;
    create_timeline_event?: boolean;
    description?: string;
  },
) {
  const { user } = await requireProfile();
  if (body.latitude === undefined || body.longitude === undefined) {
    throw new ApiError("latitude and longitude are required", 400);
  }
  const log = await addLocationLog(user.id, id, {
    location_text: body.location_text,
    latitude: body.latitude,
    longitude: body.longitude,
    add_timeline: body.create_timeline_event,
  });
  const live = await fetchShipmentLive(id);
  return { location_log: log, live };
}

export async function createDelay(
  id: string,
  body: { reason: string; new_eta: string; notify_customer?: boolean },
) {
  const { user } = await requireProfile();
  const before = await getShipment(id);
  const result = await recordDelay(user.id, id, { reason: body.reason, new_eta: body.new_eta });

  if (body.notify_customer && before.receiver_email) {
    await sendDelayEmail({
      to: before.receiver_email,
      tracking_code: before.tracking_code,
      receiver_name: before.receiver_name,
      reason: body.reason,
      new_eta: body.new_eta,
      origin: before.origin,
      destination: before.destination,
    });
    await supabase.from("delays").update({ notified_customer: true }).eq("id", result.delay.id);
  }

  return result.delay;
}

export async function clearDelay(id: string) {
  const { user } = await requireProfile();
  const row = await import("../shipments-service").then((m) => m.clearDelay(user.id, id));
  return toShipment(row);
}

export async function previewEta(body: {
  mode_id: string;
  distance_km: number;
  depart_time: string;
  speed_kmh?: number;
  service_type?: string;
}) {
  const { supabase } = await import("../supabase");
  const { previewEta: calcEta } = await import("../eta");
  const { data: mode, error } = await supabase.from("modes").select("*").eq("id", body.mode_id).single();
  if (error) throw error;
  const result = calcEta(
    mode,
    body.distance_km,
    body.depart_time,
    body.speed_kmh ?? Number(mode.default_speed_kmh),
    body.service_type as import("../types").ServiceType | undefined,
  );
  return {
    mode_code: mode.code,
    distance_km: body.distance_km,
    depart_time: body.depart_time,
    system_calculated_eta: result.eta.toISOString(),
    breakdown: result.breakdown,
  };
}

export { restoreShipment };

export async function fetchTimelineEvents(id: string) {
  const full = await getShipmentFull(id);
  return { data: full.timeline_events };
}

export async function createTimelineEvent(
  id: string,
  body: Parameters<typeof addTimelineEvent>[1],
) {
  return addTimelineEvent(id, body);
}

export async function fetchDelays(id: string) {
  const full = await getShipmentFull(id);
  return { data: full.delays };
}

export async function fetchLocationLogs(id: string) {
  const full = await getShipmentFull(id);
  return { data: full.location_logs };
}

export async function createLocationLog(
  id: string,
  body: { location_text: string; latitude: number; longitude: number; source?: string },
) {
  const { user } = await requireProfile();
  return addLocationLog(user.id, id, body);
}

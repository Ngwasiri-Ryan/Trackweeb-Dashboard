import { supabase } from "./supabase";
import { calculateSystemEta, previewEta, speedBasedProgress, suggestStatusFromProgress } from "./eta";
import { ensureRoutePolyline, estimateRoute, extractPolylinePoints, polylineDistanceKm, positionOnPolyline } from "./geopath";
import { buildLiveView, currentProgress, finalEta } from "./live-tracking";
import {
  canTransitionStatus,
  isValidManualTrackingCode,
  normalizeTrackingCode,
} from "./shipment-utils";
import type { Mode, ModeCode, ServiceType, ShipmentRow } from "./types";

const shipmentSelect = "*, modes(*)";

export async function listShipments(opts?: {
  search?: string;
  status?: string;
  mode_id?: string;
  is_delayed?: boolean;
  isArchived?: boolean;
  page?: number;
  limit?: number;
  sort?: string;
}) {
  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 25;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const sort = opts?.sort ?? "-depart_time";
  const desc = sort.startsWith("-");
  const field = desc ? sort.slice(1) : sort;

  let q = supabase
    .from("shipments")
    .select(`${shipmentSelect}, delays(*)`, { count: "exact" })
    .eq("is_archived", opts?.isArchived ?? false)
    .order(field === "final_eta" ? "system_calculated_eta" : field, { ascending: !desc })
    .range(from, to);

  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.mode_id) q = q.eq("mode_id", opts.mode_id);
  if (opts?.is_delayed !== undefined) q = q.eq("is_delayed", opts.is_delayed);
  if (opts?.search) {
    q = q.or(
      `tracking_code.ilike.%${opts.search}%,receiver_name.ilike.%${opts.search}%,sender_name.ilike.%${opts.search}%,customer_reference.ilike.%${opts.search}%,origin.ilike.%${opts.search}%,destination.ilike.%${opts.search}%`,
    );
  }

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data as ShipmentRow[], total: count ?? 0, page, limit };
}

export async function getShipment(id: string) {
  const { data, error } = await supabase
    .from("shipments")
    .select(shipmentSelect)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as ShipmentRow;
}

export async function getShipmentByCode(code: string) {
  const trackingCode = normalizeTrackingCode(code);
  const { data, error } = await supabase
    .from("shipments")
    .select(shipmentSelect)
    .eq("tracking_code", trackingCode)
    .eq("is_archived", false)
    .maybeSingle();
  if (error) throw error;
  return data as ShipmentRow | null;
}

export async function getShipmentFull(id: string) {
  const shipment = await getShipment(id);
  const [timeline, delays, locationLogs] = await Promise.all([
    supabase.from("timeline_events").select("*").eq("shipment_id", id).order("event_time", { ascending: false }),
    supabase.from("delays").select("*").eq("shipment_id", id).order("created_at", { ascending: false }),
    supabase.from("location_logs").select("*").eq("shipment_id", id).order("created_at", { ascending: false }),
  ]);
  if (timeline.error) throw timeline.error;
  if (delays.error) throw delays.error;
  if (locationLogs.error) throw locationLogs.error;
  return {
    shipment,
    timeline_events: timeline.data ?? [],
    delays: delays.data ?? [],
    location_logs: locationLogs.data ?? [],
  };
}

export async function createShipment(
  userId: string,
  tenantId: string,
  input: {
    mode_id: string;
    tracking_code?: string;
    customer_reference?: string;
    receiver_name: string;
    receiver_phone?: string;
    receiver_email?: string;
    sender_name: string;
    sender_phone?: string;
    origin: string;
    destination: string;
    origin_lat?: number;
    origin_lng?: number;
    dest_lat?: number;
    dest_lng?: number;
    distance_km?: number;
    depart_time: string;
    shipping_date?: string;
    weight_kg?: number;
    speed_kmh?: number;
    service_type?: ServiceType;
    parcel_quantity?: number;
    parcel_dimensions?: { length_cm?: number; width_cm?: number; height_cm?: number };
    notes?: string;
    route_id?: string;
  },
) {
  let data = { ...input };

  if (input.route_id) {
    const { data: route, error } = await supabase
      .from("routes")
      .select("*, modes(*)")
      .eq("id", input.route_id)
      .eq("is_active", true)
      .single();
    if (error) throw error;
    data = {
      ...data,
      origin: route.origin,
      destination: route.destination,
      distance_km: Number(route.distance_km),
      mode_id: route.mode_id,
    };
  }

  const { data: mode, error: modeErr } = await supabase
    .from("modes")
    .select("*")
    .eq("id", data.mode_id)
    .single();
  if (modeErr) throw modeErr;

  let distanceKm = data.distance_km;
  let originLat = data.origin_lat;
  let originLng = data.origin_lng;
  let destLat = data.dest_lat;
  let destLng = data.dest_lng;

  if (!distanceKm || distanceKm <= 0) {
    const estimate = await estimateRoute({
      origin: data.origin,
      destination: data.destination,
      modeCode: mode.code,
      originLat,
      originLng,
      destLat,
      destLng,
      speedKmh: data.speed_kmh ?? Number(mode.default_speed_kmh),
    });
    distanceKm = estimate.distance_km;
    originLat = estimate.origin_lat;
    originLng = estimate.origin_lng;
    destLat = estimate.dest_lat;
    destLng = estimate.dest_lng;
  }

  const departTime = new Date(data.depart_time);
  const speedKmh = data.speed_kmh ?? Number(mode.default_speed_kmh);
  const serviceType = data.service_type ?? "standard";
  const { eta } = calculateSystemEta(mode as Mode, distanceKm, departTime, { speedKmh, serviceType });

  let trackingCode: string;
  if (data.tracking_code?.trim()) {
    trackingCode = normalizeTrackingCode(data.tracking_code);
    if (!isValidManualTrackingCode(trackingCode)) {
      throw new Error("tracking_code must be 3–50 alphanumeric characters");
    }
    const existing = await getShipmentByCode(trackingCode);
    if (existing) throw new Error("tracking_code already in use");
  } else {
    const { data: code, error } = await supabase.rpc("generate_tracking_code", {
      p_mode_code: mode.code as ModeCode,
    });
    if (error) throw error;
    trackingCode = code as string;
  }

  const { data: shipment, error: createErr } = await supabase
    .from("shipments")
    .insert({
      tenant_id: tenantId,
      tracking_code: trackingCode,
      customer_reference: data.customer_reference,
      mode_id: mode.id,
      status: "booked",
      receiver_name: data.receiver_name,
      receiver_phone: data.receiver_phone,
      receiver_email: data.receiver_email,
      sender_name: data.sender_name,
      sender_phone: data.sender_phone,
      origin: data.origin,
      origin_lat: originLat,
      origin_lng: originLng,
      destination: data.destination,
      dest_lat: destLat,
      dest_lng: destLng,
      distance_km: distanceKm,
      shipping_date: data.shipping_date ?? data.depart_time,
      depart_time: data.depart_time,
      weight_kg: data.weight_kg,
      speed_kmh: speedKmh,
      service_type: data.service_type ?? "standard",
      parcel_quantity: data.parcel_quantity ?? 1,
      parcel_dimensions: data.parcel_dimensions ?? null,
      system_calculated_eta: eta.toISOString(),
      notes: data.notes,
      created_by: userId,
      updated_by: userId,
      current_location_text: data.origin,
      current_location_lat: originLat,
      current_location_lng: originLng,
    })
    .select(shipmentSelect)
    .single();
  if (createErr) throw createErr;

  await supabase.from("timeline_events").insert({
    shipment_id: shipment.id,
    status_code: "booked",
    location_text: data.origin,
    location_lat: originLat,
    location_lng: originLng,
    description: "Shipment booked",
    event_time: new Date().toISOString(),
  });

  await ensureRoutePolyline(shipment as ShipmentRow, async (updates) => {
    const { error } = await supabase.from("shipments").update(updates).eq("id", shipment.id);
    if (error) throw error;
  });

  return getShipment(shipment.id);
}

export async function updateStatus(
  userId: string,
  id: string,
  input: {
    status: string;
    location_text?: string;
    location_lat?: number;
    location_lng?: number;
    description?: string;
    event_time?: string;
  },
) {
  const shipment = await getShipment(id);
  if (shipment.is_archived) throw new Error("Shipment is archived");
  if (!canTransitionStatus(shipment.status, input.status)) {
    throw new Error(`Cannot transition from ${shipment.status} to ${input.status}`);
  }

  const eventTime = input.event_time ?? new Date().toISOString();
  const updates: Record<string, unknown> = {
    status: input.status,
    updated_by: userId,
  };
  if (input.location_text) updates.current_location_text = input.location_text;
  if (input.location_lat !== undefined) updates.current_location_lat = input.location_lat;
  if (input.location_lng !== undefined) updates.current_location_lng = input.location_lng;
  if (input.status === "delivered") updates.is_delayed = false;

  const { error } = await supabase.from("shipments").update(updates).eq("id", id);
  if (error) throw error;

  await supabase.from("timeline_events").insert({
    shipment_id: id,
    status_code: input.status,
    location_text: input.location_text,
    location_lat: input.location_lat,
    location_lng: input.location_lng,
    description: input.description ?? `Status changed to ${input.status}`,
    event_time: eventTime,
  });

  return getShipment(id);
}

export async function recordDelay(
  userId: string,
  shipmentId: string,
  input: { reason: string; new_eta: string },
) {
  const shipment = await getShipment(shipmentId);
  const newEta = new Date(input.new_eta);
  const oldEta = finalEta(shipment);
  if (newEta <= oldEta) throw new Error("new_eta must be after current final_eta");

  const progress = currentProgress(shipment as ShipmentRow & { modes: Mode });
  const points = extractPolylinePoints(shipment.route_polyline);
  let lat = shipment.current_location_lat;
  let lng = shipment.current_location_lng;
  if (points.length >= 2) {
    [lat, lng] = positionOnPolyline(points, progress);
  }

  const { data: delay, error: delayErr } = await supabase
    .from("delays")
    .insert({
      shipment_id: shipmentId,
      reason: input.reason,
      old_eta: oldEta.toISOString(),
      new_eta: input.new_eta,
      status_at_delay: shipment.status,
      created_by: userId,
    })
    .select()
    .single();
  if (delayErr) throw delayErr;

  await supabase
    .from("shipments")
    .update({
      manual_override_eta: input.new_eta,
      is_delayed: true,
      delay_paused_progress: progress,
      delay_pause_started_at: new Date().toISOString(),
      current_location_text: shipment.current_location_text ?? "Delayed — holding position",
      current_location_lat: lat,
      current_location_lng: lng,
      use_manual_position: false,
      updated_by: userId,
    })
    .eq("id", shipmentId);

  await supabase.from("timeline_events").insert({
    shipment_id: shipmentId,
    status_code: shipment.status,
    location_text: shipment.current_location_text ?? "Delayed — holding position",
    location_lat: lat,
    location_lng: lng,
    description: `Delay recorded: ${input.reason}. Shipment paused at ${Math.round(progress * 100)}% of route.`,
    is_delay_event: true,
    delay_reason: input.reason,
    event_time: new Date().toISOString(),
  });

  return { delay, shipment: await getShipment(shipmentId) };
}

export async function clearDelay(userId: string, shipmentId: string, clearOverride = false) {
  const shipment = await getShipment(shipmentId);
  const now = new Date();
  const extraPauseMs =
    shipment.is_delayed && shipment.delay_pause_started_at
      ? now.getTime() - new Date(shipment.delay_pause_started_at).getTime()
      : 0;

  const resumedText =
    shipment.current_location_text?.replace(/^Delayed — holding position$/, "In transit") ??
    "In transit — resumed after delay";

  const updates: Record<string, unknown> = {
    is_delayed: false,
    delay_paused_progress: null,
    delay_pause_started_at: null,
    delay_pause_total_ms: (shipment.delay_pause_total_ms ?? 0) + extraPauseMs,
    current_location_text: resumedText,
    updated_by: userId,
  };
  if (clearOverride) updates.manual_override_eta = null;

  await supabase.from("shipments").update(updates).eq("id", shipmentId);

  await supabase.from("timeline_events").insert({
    shipment_id: shipmentId,
    status_code: shipment.status,
    location_text: "In transit — resumed after delay",
    description: "Delay cleared — shipment resuming at normal speed",
    event_time: now.toISOString(),
  });

  return getShipment(shipmentId);
}

export async function overrideEta(
  userId: string,
  id: string,
  manualOverrideEta: string | null,
  reason?: string,
) {
  const shipment = await getShipment(id);
  if (manualOverrideEta && new Date(manualOverrideEta) < new Date(shipment.depart_time)) {
    throw new Error("ETA cannot be before depart_time");
  }

  await supabase
    .from("shipments")
    .update({ manual_override_eta: manualOverrideEta, updated_by: userId })
    .eq("id", id);

  await supabase.from("timeline_events").insert({
    shipment_id: id,
    status_code: shipment.status,
    description:
      reason ??
      (manualOverrideEta
        ? `ETA manually overridden to ${new Date(manualOverrideEta).toLocaleString()}`
        : "Manual ETA override cleared"),
    event_time: new Date().toISOString(),
  });

  return getShipment(id);
}

export async function recalculateEta(id: string) {
  const shipment = await getShipment(id);
  const mode = shipment.modes as Mode;
  const distanceKm = Number(shipment.distance_km ?? 0);
  const speedKmh = shipment.speed_kmh ? Number(shipment.speed_kmh) : Number(mode.default_speed_kmh);
  const { eta } = calculateSystemEta(mode, distanceKm, new Date(shipment.depart_time), {
    speedKmh,
    serviceType: shipment.service_type,
  });
  await supabase.from("shipments").update({ system_calculated_eta: eta.toISOString() }).eq("id", id);
  return {
    system_calculated_eta: eta.toISOString(),
    final_eta: finalEta({ ...shipment, system_calculated_eta: eta.toISOString() }).toISOString(),
    manual_override_eta: shipment.manual_override_eta,
  };
}

export async function estimateRoutePreview(input: {
  mode_id: string;
  origin: string;
  destination: string;
  depart_time?: string;
  speed_kmh?: number;
  service_type?: ServiceType;
}) {
  const { data: mode, error } = await supabase.from("modes").select("*").eq("id", input.mode_id).single();
  if (error) throw error;
  const estimate = await estimateRoute({
    origin: input.origin,
    destination: input.destination,
    modeCode: mode.code,
    speedKmh: input.speed_kmh ?? Number(mode.default_speed_kmh),
  });
  let system_calculated_eta: string | null = null;
  let breakdown = null;
  if (input.depart_time) {
    const result = previewEta(
      mode as Mode,
      estimate.distance_km,
      input.depart_time,
      input.speed_kmh ?? Number(mode.default_speed_kmh),
      input.service_type,
    );
    system_calculated_eta = result.eta.toISOString();
    breakdown = result.breakdown;
  }
  const speed = input.speed_kmh ?? Number(mode.default_speed_kmh);
  return {
    ...estimate,
    system_calculated_eta,
    breakdown,
    mode_code: mode.code,
    travel_time_hours: estimate.duration_hours,
    polyline_points: estimate.polyline.points?.length ?? 0,
    suggested_speed_kmh: speed,
  };
}

export async function addLocationLog(
  userId: string,
  shipmentId: string,
  input: { location_text: string; latitude?: number; longitude?: number; add_timeline?: boolean },
) {
  await supabase.from("location_logs").update({ is_current: false }).eq("shipment_id", shipmentId);

  const { data: log, error } = await supabase
    .from("location_logs")
    .insert({
      shipment_id: shipmentId,
      location_text: input.location_text,
      latitude: input.latitude,
      longitude: input.longitude,
      is_current: true,
      source: "manual",
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from("shipments")
    .update({
      current_location_text: input.location_text,
      current_location_lat: input.latitude,
      current_location_lng: input.longitude,
      use_manual_position: true,
      updated_by: userId,
    })
    .eq("id", shipmentId);

  if (input.add_timeline) {
    const shipment = await getShipment(shipmentId);
    await supabase.from("timeline_events").insert({
      shipment_id: shipmentId,
      status_code: shipment.status,
      location_text: input.location_text,
      location_lat: input.latitude,
      location_lng: input.longitude,
      description: `Location updated: ${input.location_text}`,
      event_time: new Date().toISOString(),
    });
  }

  return log;
}

export async function archiveShipment(id: string) {
  const { error } = await supabase.from("shipments").update({ is_archived: true }).eq("id", id);
  if (error) throw error;
}

export async function restoreShipment(id: string) {
  const { error } = await supabase.from("shipments").update({ is_archived: false }).eq("id", id);
  if (error) throw error;
  return getShipment(id);
}

export async function updateShipment(userId: string, id: string, input: Record<string, unknown>) {
  const existing = await getShipment(id);
  const mode = existing.modes as Mode;
  const departTime = input.depart_time ? new Date(String(input.depart_time)) : new Date(existing.depart_time);
  const distanceKm = input.distance_km !== undefined ? Number(input.distance_km) : Number(existing.distance_km ?? 0);
  const speedKmh =
    input.speed_kmh !== undefined
      ? Number(input.speed_kmh)
      : existing.speed_kmh
        ? Number(existing.speed_kmh)
        : Number(mode.default_speed_kmh);
  const serviceType = (input.service_type as ServiceType) ?? existing.service_type;

  let systemCalculatedEta = existing.system_calculated_eta;
  if (
    input.distance_km !== undefined ||
    input.depart_time !== undefined ||
    input.speed_kmh !== undefined ||
    input.service_type !== undefined
  ) {
    systemCalculatedEta = calculateSystemEta(mode, distanceKm, departTime, { speedKmh, serviceType }).eta.toISOString();
  }

  const payload: Record<string, unknown> = { ...input, updated_by: userId, system_calculated_eta: systemCalculatedEta };
  if (input.origin || input.destination) {
    payload.route_polyline = null;
    payload.route_polyline_source = null;
  }

  const { error } = await supabase.from("shipments").update(payload).eq("id", id);
  if (error) throw error;

  if (input.origin || input.destination) {
    const shipment = await getShipment(id);
    await ensureRoutePolyline(shipment, async (updates) => {
      const { error: uErr } = await supabase.from("shipments").update(updates).eq("id", id);
      if (uErr) throw uErr;
    });
  }

  return getShipment(id);
}

export async function addTimelineEvent(
  shipmentId: string,
  input: {
    status_code: string;
    location_text?: string;
    description?: string;
    event_time?: string;
    is_delay_event?: boolean;
    delay_reason?: string;
  },
) {
  const { data, error } = await supabase
    .from("timeline_events")
    .insert({
      shipment_id: shipmentId,
      status_code: input.status_code,
      location_text: input.location_text,
      description: input.description,
      is_delay_event: input.is_delay_event ?? false,
      delay_reason: input.delay_reason,
      event_time: input.event_time ?? new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTimelineEvent(id: string) {
  const { error } = await supabase.from("timeline_events").delete().eq("id", id);
  if (error) throw error;
}

export async function updateTimelineEvent(
  id: string,
  input: { location_text?: string; description?: string; delay_reason?: string },
) {
  const { data, error } = await supabase.from("timeline_events").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function updateDelay(id: string, input: { reason?: string; notified_customer?: boolean }) {
  const { data, error } = await supabase.from("delays").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function notifyDelay(delayId: string, shipmentId: string) {
  const shipment = await getShipment(shipmentId);
  const { data: delay, error } = await supabase.from("delays").select("*").eq("id", delayId).single();
  if (error) throw error;

  let emailResult: { sent: boolean; error?: string } = { sent: false, error: "No receiver email" };
  if (shipment.receiver_email) {
    const { sendDelayEmail } = await import("./notifications");
    emailResult = await sendDelayEmail({
      to: shipment.receiver_email,
      tracking_code: shipment.tracking_code,
      receiver_name: shipment.receiver_name,
      reason: delay.reason,
      new_eta: delay.new_eta,
      origin: shipment.origin,
      destination: shipment.destination,
    });
  }

  await supabase.from("delays").update({ notified_customer: true }).eq("id", delayId);
  return {
    notified_customer: true,
    sent_to: emailResult.sent ? shipment.receiver_email : null,
    error: emailResult.error ?? null,
  };
}

export async function removeLocationLog(shipmentId: string, logId: string) {
  const { data: log, error: findErr } = await supabase
    .from("location_logs")
    .select("*")
    .eq("id", logId)
    .eq("shipment_id", shipmentId)
    .single();
  if (findErr) throw findErr;

  await supabase.from("location_logs").delete().eq("id", logId);

  if (log.is_current) {
    const { data: latest } = await supabase
      .from("location_logs")
      .select("*")
      .eq("shipment_id", shipmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest) {
      await supabase.from("location_logs").update({ is_current: true }).eq("id", latest.id);
      await supabase
        .from("shipments")
        .update({
          current_location_text: latest.location_text,
          current_location_lat: latest.latitude,
          current_location_lng: latest.longitude,
          use_manual_position: latest.source === "manual",
        })
        .eq("id", shipmentId);
    }
  }
}

/** Auto-advance status from route progress (backend syncStatusFromRouteProgress). */
export async function syncStatusFromRouteProgress(id: string): Promise<ShipmentRow> {
  let shipment = await getShipment(id);
  if (shipment.use_manual_position || shipment.is_archived) return shipment;

  await ensureRoutePolyline(shipment, async (updates) => {
    await supabase.from("shipments").update(updates).eq("id", id);
  });
  shipment = await getShipment(id);
  const mode = shipment.modes as Mode;
  const points = extractPolylinePoints(shipment.route_polyline);
  const totalKm = (points.length >= 2 ? polylineDistanceKm(points) : 0) || Number(shipment.distance_km) || 0;
  const speed = Number(shipment.speed_kmh) || Number(mode.default_speed_kmh) || 80;
  const progress = speedBasedProgress(
    new Date(shipment.depart_time),
    speed,
    totalKm,
    new Date(),
    shipment.status,
    {
      isDelayed: shipment.is_delayed,
      pausedProgress: shipment.delay_paused_progress,
      pauseTotalMs: shipment.delay_pause_total_ms ?? 0,
    },
  );
  const suggested = suggestStatusFromProgress(shipment.status, progress, new Date(shipment.depart_time));
  if (!suggested || suggested === shipment.status || !canTransitionStatus(shipment.status, suggested)) {
    return shipment;
  }

  await supabase
    .from("shipments")
    .update({
      status: suggested,
      ...(suggested === "delivered" ? { is_delayed: false } : {}),
    })
    .eq("id", id);

  await supabase.from("timeline_events").insert({
    shipment_id: id,
    status_code: suggested,
    location_text: shipment.current_location_text,
    description: `Status auto-updated from route progress (${Math.round(progress * 100)}%)`,
    event_time: new Date().toISOString(),
  });

  return getShipment(id);
}

export async function getShipmentLive(id: string) {
  const synced = await syncStatusFromRouteProgress(id);
  const mode = synced.modes as Mode;
  const map = buildLiveView({ ...synced, modes: mode });
  const full = await getShipmentFull(id);
  return {
    shipment: synced,
    map,
    timeline_events: full.timeline_events.slice(0, 10),
    location_logs: full.location_logs,
    delays: full.delays,
    estimated_arrival: finalEta(synced).toISOString(),
  };
}

import { supabase } from "./supabase";
import { buildLiveView, finalEta } from "./live-tracking";
import { hoursOverdue } from "./eta";
import type { LiveMapItem, Mode, ShipmentRow } from "./types";

function dayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function getDashboardSummary(dateStr?: string) {
  const date = dateStr ? new Date(dateStr) : new Date();
  const { start, end } = dayBounds(date);

  const { data: rows, error } = await supabase
    .from("shipments")
    .select("status, is_delayed, depart_time, updated_at")
    .eq("is_archived", false);
  if (error) throw error;

  const list = rows ?? [];
  return {
    date: start.toISOString().slice(0, 10),
    today_departures: list.filter(
      (s) => s.status === "booked" && new Date(s.depart_time) >= start && new Date(s.depart_time) <= end,
    ).length,
    in_transit: list.filter((s) => s.status === "in_transit").length,
    delivered_today: list.filter(
      (s) => s.status === "delivered" && new Date(s.updated_at) >= start && new Date(s.updated_at) <= end,
    ).length,
    active_delays: list.filter((s) => s.is_delayed && s.status !== "delivered").length,
    booked: list.filter((s) => s.status === "booked").length,
    departed: list.filter((s) => s.status === "departed").length,
    arrived: list.filter((s) => s.status === "arrived").length,
    total_active: list.filter((s) => s.status !== "delivered").length,
  };
}

export async function getTodayDepartures() {
  const { start, end } = dayBounds();
  const { data, error } = await supabase
    .from("shipments")
    .select("*, modes(*)")
    .eq("is_archived", false)
    .gte("depart_time", start.toISOString())
    .lte("depart_time", end.toISOString())
    .order("depart_time");
  if (error) throw error;
  return data as ShipmentRow[];
}

export async function getInTransit() {
  const { data, error } = await supabase
    .from("shipments")
    .select("*, modes(*)")
    .eq("is_archived", false)
    .eq("status", "in_transit")
    .order("depart_time");
  if (error) throw error;
  return data as ShipmentRow[];
}

export async function getDelayedShipments() {
  const { data, error } = await supabase
    .from("shipments")
    .select("*, modes(*), delays(*)")
    .eq("is_archived", false)
    .eq("is_delayed", true)
    .eq("status", "in_transit");
  if (error) throw error;
  return data ?? [];
}

export async function getArrivingToday() {
  const { start, end } = dayBounds();
  const { data, error } = await supabase
    .from("shipments")
    .select("*, modes(*)")
    .eq("is_archived", false)
    .neq("status", "delivered");
  if (error) throw error;
  return (data as ShipmentRow[]).filter((s) => {
    const eta = finalEta(s);
    return eta >= start && eta <= end;
  });
}

export async function getOverdueShipments() {
  const now = new Date();
  const { data, error } = await supabase
    .from("shipments")
    .select("*, modes(*)")
    .eq("is_archived", false)
    .neq("status", "delivered");
  if (error) throw error;
  return (data as ShipmentRow[])
    .filter((s) => finalEta(s) < now)
    .map((s) => ({ ...s, hours_overdue: hoursOverdue(finalEta(s)) }));
}

export async function getStatsByMode() {
  const { data: modes } = await supabase.from("modes").select("*").eq("is_active", true);
  const { data: shipments, error } = await supabase.from("shipments").select("mode_id, status, is_delayed").eq("is_archived", false);
  if (error) throw error;
  return (modes ?? []).map((m) => ({
    mode_code: m.code,
    mode_name: m.display_name,
    count: (shipments ?? []).filter((s) => s.mode_id === m.id).length,
    in_transit: (shipments ?? []).filter((s) => s.mode_id === m.id && s.status === "in_transit").length,
    delayed: (shipments ?? []).filter((s) => s.mode_id === m.id && s.is_delayed).length,
  }));
}

export async function getStatsByStatus() {
  const { data: statuses } = await supabase.from("statuses").select("*").order("step_order");
  const { data: shipments, error } = await supabase.from("shipments").select("status").eq("is_archived", false);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const s of shipments ?? []) counts[s.status] = (counts[s.status] ?? 0) + 1;
  return (statuses ?? []).map((st) => ({
    status: st.code,
    display_name: st.display_name,
    count: counts[st.code] ?? 0,
    color_hex: st.color_hex,
  }));
}

export async function getDeliveryPerformance(fromStr?: string, toStr?: string) {
  const to = toStr ? new Date(toStr) : new Date();
  const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - 30 * 86400000);
  const { data: delivered, error } = await supabase
    .from("shipments")
    .select("updated_at, system_calculated_eta")
    .eq("status", "delivered")
    .gte("updated_at", from.toISOString())
    .lte("updated_at", to.toISOString());
  if (error) throw error;
  let onTime = 0;
  let delayed = 0;
  let totalDelayHours = 0;
  for (const s of delivered ?? []) {
    const deliveredAt = new Date(s.updated_at);
    const scheduled = new Date(s.system_calculated_eta);
    if (deliveredAt <= scheduled) onTime++;
    else {
      delayed++;
      totalDelayHours += (deliveredAt.getTime() - scheduled.getTime()) / 3600000;
    }
  }
  const total = delivered?.length ?? 0;
  return {
    period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    total_delivered: total,
    on_time: onTime,
    delayed,
    on_time_percentage: total > 0 ? Math.round((onTime / total) * 10000) / 100 : 0,
    avg_delay_hours: delayed > 0 ? Math.round((totalDelayHours / delayed) * 10) / 10 : 0,
  };
}

export async function getStatsActivity(fromStr?: string, toStr?: string) {
  const to = toStr ? new Date(toStr) : new Date();
  const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - 14 * 86400000);
  const { data: shipments } = await supabase
    .from("shipments")
    .select("created_at, status, updated_at")
    .gte("created_at", from.toISOString());
  const { data: delays } = await supabase.from("delays").select("created_at").gte("created_at", from.toISOString());

  const buckets: Record<string, { created: number; delivered: number; delays_recorded: number }> = {};
  for (const s of shipments ?? []) {
    const d = s.created_at.slice(0, 10);
    buckets[d] ??= { created: 0, delivered: 0, delays_recorded: 0 };
    buckets[d].created++;
    if (s.status === "delivered") {
      const dd = s.updated_at.slice(0, 10);
      buckets[dd] ??= { created: 0, delivered: 0, delays_recorded: 0 };
      buckets[dd].delivered++;
    }
  }
  for (const d of delays ?? []) {
    const day = d.created_at.slice(0, 10);
    buckets[day] ??= { created: 0, delivered: 0, delays_recorded: 0 };
    buckets[day].delays_recorded++;
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
}

export async function getLiveMapShipments(filters?: { status?: string; mode_id?: string; is_delayed?: boolean }): Promise<LiveMapItem[]> {
  let q = supabase.from("shipments").select("*, modes(*)").eq("is_archived", false).neq("status", "delivered");
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.mode_id) q = q.eq("mode_id", filters.mode_id);
  if (filters?.is_delayed !== undefined) q = q.eq("is_delayed", filters.is_delayed);
  const { data, error } = await q;
  if (error) throw error;

  return (data as (ShipmentRow & { modes: Mode })[]).map((s) => {
    const live = buildLiveView(s);
    const eta = finalEta(s);
    const mode = s.modes;
    return {
      id: s.id,
      tracking_code: s.tracking_code,
      status: s.status,
      is_delayed: s.is_delayed,
      receiver_name: s.receiver_name,
      origin: s.origin,
      destination: s.destination,
      origin_lat: live.origin.lat,
      origin_lng: live.origin.lng,
      dest_lat: live.destination.lat,
      dest_lng: live.destination.lng,
      current_location_text: s.current_location_text,
      current_location_lat: live.simulated_position.lat,
      current_location_lng: live.simulated_position.lng,
      depart_time: s.depart_time,
      progress_percent: live.progress_percent,
      final_eta: eta.toISOString(),
      geopath: live.polyline.map(([lat, lng]) => ({ lat, lng })),
      speed_kmh: live.motion.speed_kmh ?? undefined,
      polyline_source: (live.polyline_source as LiveMapItem["polyline_source"]) ?? undefined,
      motion: {
        is_moving: live.motion.is_moving,
        is_delayed: live.motion.is_delayed,
        position_source: live.motion.position_source,
        remaining_hours: live.motion.remaining_hours,
      },
      mode: {
        code: mode.code,
        display_name: mode.display_name,
        icon: mode.icon ?? "truck",
      },
    };
  });
}

export async function getLiveUpdates(since: string) {
  const sinceDate = new Date(since);
  const { data: changed, error } = await supabase
    .from("shipments")
    .select("*, modes(*)")
    .eq("is_archived", false)
    .gt("updated_at", sinceDate.toISOString());
  if (error) throw error;

  const active = (changed as (ShipmentRow & { modes: Mode })[]).filter(
    (s) => !s.is_archived && s.status !== "delivered",
  );
  const removed = (changed ?? []).filter((s) => s.is_archived || s.status === "delivered").map((s) => s.id);

  return {
    since,
    updated_at: new Date().toISOString(),
    changed: active.map((s) => {
      const live = buildLiveView(s);
      return {
        id: s.id,
        tracking_code: s.tracking_code,
        status: s.status,
        is_delayed: s.is_delayed,
        current_location_lat: live.simulated_position.lat,
        current_location_lng: live.simulated_position.lng,
        progress_percent: live.progress_percent,
        updated_at: s.updated_at,
      };
    }),
    removed,
  };
}

export async function getRecentActivity(limit = 20) {
  const { data, error } = await supabase
    .from("timeline_events")
    .select("*, shipments(tracking_code)")
    .order("event_time", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((e) => ({
    type: e.is_delay_event ? "delay_recorded" : "status_update",
    shipment_id: e.shipment_id,
    tracking_code: (e.shipments as { tracking_code: string })?.tracking_code ?? "",
    description: e.description ?? e.status_code,
    timestamp: e.event_time,
  }));
}

export async function searchShipments(q: string) {
  const { data, error } = await supabase
    .from("shipments")
    .select("id, tracking_code, receiver_name, destination, status, customer_reference")
    .or(
      `tracking_code.ilike.%${q}%,receiver_name.ilike.%${q}%,customer_reference.ilike.%${q}%,sender_name.ilike.%${q}%`,
    )
    .eq("is_archived", false)
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

export function shipmentHoursOverdue(s: ShipmentRow) {
  return hoursOverdue(finalEta(s));
}

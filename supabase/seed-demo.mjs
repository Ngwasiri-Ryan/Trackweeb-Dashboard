#!/usr/bin/env node
/**
 * Seeds demo shipments, routes, and timeline data (matches Tracking-Backend/prisma/seed.ts).
 * Idempotent: re-runs refresh demo tracking codes with current positions.
 */
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { getSetupConfig, loadProjectEnv } from "./load-env.mjs";
import {
  calculateSystemEta,
  polylineDistanceKm,
  positionOnPolyline,
  resolveDemoRoute,
} from "./lib/demo-data.mjs";

const DEMO_TRACKING_CODES = [
  "RYAN-EU-DEMO-001",
  "RYAN-RAIL-DEMO-001",
  "RYAN-AIR-DEMO-001",
  "RYAN-SEA-DEMO-001",
  "TRK-2026-R-000001",
  "TRK-2026-R-000002",
  "TRK-2026-R-000003",
  "TRK-2026-L-000001",
  "TRK-2026-A-000001",
  "TRK-2026-A-000002",
  "TRK-2026-S-000001",
  "TRK-2026-R-BOOKED",
  "TRK-2026-R-DELAYED",
];

/** Shipments whose orange dots animate along the route on the live map */
export const MOVING_DEMO_CODES = [
  "RYAN-EU-DEMO-001",
  "RYAN-RAIL-DEMO-001",
  "RYAN-AIR-DEMO-001",
  "RYAN-SEA-DEMO-001",
  "TRK-2026-R-000001",
  "TRK-2026-R-000002",
  "TRK-2026-R-000003",
  "TRK-2026-L-000001",
  "TRK-2026-A-000001",
  "TRK-2026-S-000001",
];

const DEMO_ROUTES = [
  { modeCode: "road", origin: "Paris, France", destination: "Munich, Germany", defaultDurationHours: 10.5 },
  { modeCode: "rail", origin: "London St Pancras International, UK", destination: "Paris Gare du Nord, France", defaultDurationHours: 3.8 },
  { modeCode: "air", origin: "London Heathrow Airport, UK", destination: "John F Kennedy International Airport, New York, USA", defaultDurationHours: 7.5 },
  { modeCode: "sea", origin: "Port of Rotterdam, Netherlands", destination: "Port of Hamburg, Germany", defaultDurationHours: 15 },
  { modeCode: "road", origin: "Berlin, Germany", destination: "Hamburg, Germany", defaultDurationHours: 3.6 },
  { modeCode: "sea", origin: "Port of Shanghai, China", destination: "Port of Rotterdam, Netherlands", defaultDurationHours: 720 },
];

const DEMOS = [
  // —— Live-moving demos (dots animate on map) ——
  { trackingCode: "RYAN-EU-DEMO-001", modeCode: "road", status: "in_transit", receiverName: "Ryan Ngwasiri", receiverEmail: "ryanngwasiri@gmail.com", senderName: "Trackweeb Demo Logistics", origin: "Paris, France", destination: "Munich, Germany", departHoursAgo: 2, notes: "Live road demo — dot moves along A4/A6 autobahn", locationHint: "Near Strasbourg, France" },
  { trackingCode: "RYAN-RAIL-DEMO-001", modeCode: "rail", status: "in_transit", receiverName: "Ryan Ngwasiri", receiverEmail: "ryanngwasiri@gmail.com", senderName: "Trackweeb Demo Logistics", origin: "London St Pancras International, UK", destination: "Paris Gare du Nord, France", departHoursAgo: 1.2, notes: "Live rail demo — Eurostar corridor", locationHint: "Near Calais, France" },
  { trackingCode: "RYAN-AIR-DEMO-001", modeCode: "air", status: "in_transit", receiverName: "Ryan Ngwasiri", receiverEmail: "ryanngwasiri@gmail.com", senderName: "Trackweeb Demo Logistics", origin: "London Heathrow Airport, UK", destination: "John F Kennedy International Airport, New York, USA", departHoursAgo: 2.5, notes: "Live air demo — transatlantic LHR to JFK", locationHint: "Over North Atlantic" },
  { trackingCode: "RYAN-SEA-DEMO-001", modeCode: "sea", status: "in_transit", receiverName: "Ryan Ngwasiri", receiverEmail: "ryanngwasiri@gmail.com", senderName: "Trackweeb Demo Logistics", origin: "Port of Rotterdam, Netherlands", destination: "Port of Hamburg, Germany", departHoursAgo: 3, notes: "Live short-sea demo — North Sea feeder", locationHint: "North Sea transit" },
  { trackingCode: "TRK-2026-R-000001", modeCode: "road", status: "in_transit", receiverName: "Acme Corp", receiverEmail: "receiving@acme.com", senderName: "Supplier GmbH", origin: "Berlin, Germany", destination: "Hamburg, Germany", departHoursAgo: 0.75, customerReference: "PO-88421", locationHint: "Near Hanover, Germany" },
  { trackingCode: "TRK-2026-R-000002", modeCode: "road", status: "in_transit", receiverName: "Fast Parts Co", receiverEmail: "logistics@fastparts.com", senderName: "Munich Warehouse", origin: "Munich, Germany", destination: "Frankfurt, Germany", departHoursAgo: 0.5, customerReference: "PO-99102", locationHint: "Near Nuremberg, Germany" },
  { trackingCode: "TRK-2026-R-000003", modeCode: "road", status: "in_transit", receiverName: "Global Imports Ltd", receiverEmail: "imports@global.com", senderName: "Rotterdam Freight", origin: "Rotterdam, Netherlands", destination: "Paris, France", departHoursAgo: 1.5, customerReference: "PO-77201", locationHint: "Near Antwerp, Belgium" },
  { trackingCode: "TRK-2026-L-000001", modeCode: "rail", status: "in_transit", receiverName: "Alpine Logistics AG", receiverEmail: "ops@alpinelogistics.ch", senderName: "Milan Intermodal Terminal", origin: "Milan Centrale, Italy", destination: "Zürich Hauptbahnhof, Switzerland", departHoursAgo: 0.8, customerReference: "RL-4401", locationHint: "Near Como, Italy" },
  { trackingCode: "TRK-2026-A-000001", modeCode: "air", status: "in_transit", receiverName: "Trackweeb Express Client", receiverEmail: "client@trackweeb.com", senderName: "Frankfurt Cargo Hub", origin: "Frankfurt Airport, Germany", destination: "Dubai International Airport, UAE", departHoursAgo: 2, locationHint: "Over Eastern Mediterranean" },
  { trackingCode: "TRK-2026-S-000001", modeCode: "sea", status: "in_transit", receiverName: "Hamburg Imports GmbH", receiverEmail: "port@hamburg-imports.de", senderName: "Shanghai Ocean Freight", origin: "Port of Shanghai, China", destination: "Port of Rotterdam, Netherlands", departHoursAgo: 120, locationHint: "Indian Ocean transit — Asia-Europe lane" },
  // —— Static reference (no dot movement) ——
  { trackingCode: "TRK-2026-R-BOOKED", modeCode: "road", status: "booked", receiverName: "Warehouse Pending Ltd", receiverEmail: "wh@pending.co", senderName: "Depot Berlin", origin: "Berlin, Germany", destination: "Prague, Czech Republic", departHoursAgo: -6, customerReference: "PO-00000", notes: "Booked — dot stays at origin until departure" },
  { trackingCode: "TRK-2026-R-DELAYED", modeCode: "road", status: "in_transit", receiverName: "Frozen Freight BV", receiverEmail: "ops@frozen.nl", senderName: "Antwerp Hub", origin: "Antwerp, Belgium", destination: "Brussels, Belgium", departHoursAgo: 2, customerReference: "PO-DLY01", locationHint: "Delayed — holding position", delay: { reason: "Customs inspection at border — vehicle holding", startedHoursAgo: 0.5, extraEtaHours: 6 } },
  { trackingCode: "TRK-2026-A-000002", modeCode: "air", status: "delivered", receiverName: "Nordic Retail AS", receiverEmail: "supply@nordic.no", senderName: "Amsterdam Schiphol Cargo", origin: "Amsterdam Airport Schiphol, Netherlands", destination: "Oslo Airport Gardermoen, Norway", departHoursAgo: 48 },
];

function authHeaders(serviceKey) {
  return { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
}

async function api(config, path, opts = {}) {
  const res = await fetch(`${config.supabaseUrl}${path}`, {
    ...opts,
    headers: { ...authHeaders(config.serviceKey), ...opts.headers },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

async function getAdminId(config) {
  const { ok, data } = await api(config, `/auth/v1/admin/users?page=1&per_page=1000`);
  if (!ok) throw new Error(`List users failed: ${JSON.stringify(data)}`);
  const user = (data.users ?? []).find((u) => u.email?.toLowerCase() === config.adminEmail.toLowerCase());
  if (!user) throw new Error(`Admin user not found: ${config.adminEmail}`);
  return user.id;
}

async function getModes(config) {
  const { ok, data } = await api(config, "/rest/v1/modes?select=*");
  if (!ok) throw new Error(`Modes fetch failed: ${JSON.stringify(data)}`);
  return Object.fromEntries(data.map((m) => [m.code, m]));
}

async function hasDemoData(config) {
  const codes = DEMO_TRACKING_CODES.map((c) => `"${c}"`).join(",");
  const { ok, data } = await api(config, `/rest/v1/shipments?select=tracking_code&tracking_code=in.(${codes})`);
  if (!ok) return false;
  return data.length >= DEMO_TRACKING_CODES.length;
}

async function clearShipmentChildren(config, shipmentId) {
  for (const table of ["timeline_events", "location_logs", "delays"]) {
    await api(config, `/rest/v1/${table}?shipment_id=eq.${shipmentId}`, { method: "DELETE" });
  }
}

async function upsertRoute(config, mode, route) {
  let distanceKm = route.defaultDurationHours * Number(mode.default_speed_kmh);
  try {
    const resolved = await resolveDemoRoute({
      origin: route.origin,
      destination: route.destination,
      modeCode: route.modeCode,
    });
    distanceKm = resolved.distance_km;
  } catch {
    /* keep estimate */
  }

  const { ok, data } = await api(
    config,
    `/rest/v1/routes?tenant_id=eq.${config.tenantId}&mode_id=eq.${mode.id}&origin=eq.${encodeURIComponent(route.origin)}&destination=eq.${encodeURIComponent(route.destination)}&select=id`,
  );
  if (!ok) throw new Error(JSON.stringify(data));

  const payload = {
    tenant_id: config.tenantId,
    mode_id: mode.id,
    origin: route.origin,
    destination: route.destination,
    distance_km: distanceKm,
    default_duration_hours: route.defaultDurationHours,
    is_active: true,
  };

  if (data?.length) {
    await api(config, `/rest/v1/routes?id=eq.${data[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({ distance_km: distanceKm, default_duration_hours: route.defaultDurationHours }),
    });
  } else {
    await api(config, "/rest/v1/routes", { method: "POST", body: JSON.stringify(payload) });
  }
}

async function upsertDemoShipment(config, adminId, mode, demo, time) {
  const route = await resolveDemoRoute({
    origin: demo.origin,
    destination: demo.destination,
    modeCode: demo.modeCode,
  });

  const departTime =
    demo.departHoursAgo >= 0 ? time.hoursAgo(demo.departHoursAgo) : time.hoursFromNow(Math.abs(demo.departHoursAgo));

  const { eta, speedKmh } = calculateSystemEta(mode, route.distance_km, departTime);
  const totalKm =
    route.polyline.points.length >= 2 ? polylineDistanceKm(route.polyline.points) : route.distance_km;

  let progress = 0;
  if (demo.status !== "booked" && demo.status !== "delivered" && totalKm > 0) {
    const elapsedHours = Math.max(0, (time.now.getTime() - departTime.getTime()) / 3_600_000);
    progress = Math.min(0.97, (speedKmh * elapsedHours) / totalKm);
  } else if (demo.status === "delivered") {
    progress = 1;
  }

  let currentLat = route.origin_lat;
  let currentLng = route.origin_lng;
  let currentText =
    demo.status === "booked"
      ? demo.origin
      : demo.status === "delivered"
        ? demo.destination
        : (demo.locationHint ?? "In transit");

  if (route.polyline.points.length >= 2 && demo.status !== "booked" && demo.status !== "delivered") {
    [currentLat, currentLng] = positionOnPolyline(route.polyline.points, progress);
  } else if (demo.status === "delivered") {
    currentLat = route.dest_lat;
    currentLng = route.dest_lng;
    currentText = demo.destination;
  }

  let isDelayed = false;
  let manualOverrideEta = null;
  let delayPausedProgress = null;
  let delayPauseStartedAt = null;

  if (demo.delay) {
    isDelayed = true;
    delayPauseStartedAt = time.hoursAgo(demo.delay.startedHoursAgo);
    const elapsedBeforePauseMs = Math.max(0, delayPauseStartedAt.getTime() - departTime.getTime());
    delayPausedProgress = Math.min(0.97, (speedKmh * (elapsedBeforePauseMs / 3_600_000)) / totalKm);
    [currentLat, currentLng] = positionOnPolyline(route.polyline.points, delayPausedProgress);
    currentText = "Delayed — holding position";
    progress = delayPausedProgress;
    manualOverrideEta = time.hoursFromNow(demo.delay.extraEtaHours);
  }

  const shipmentPayload = {
    tenant_id: config.tenantId,
    tracking_code: demo.trackingCode,
    customer_reference: demo.customerReference ?? null,
    mode_id: mode.id,
    status: demo.status,
    receiver_name: demo.receiverName,
    receiver_email: demo.receiverEmail,
    sender_name: demo.senderName,
    origin: demo.origin,
    origin_lat: route.origin_lat,
    origin_lng: route.origin_lng,
    destination: demo.destination,
    dest_lat: route.dest_lat,
    dest_lng: route.dest_lng,
    distance_km: route.distance_km,
    route_polyline: route.polyline,
    route_polyline_source: route.polyline_source,
    geocoded_at: time.now.toISOString(),
    depart_time: departTime.toISOString(),
    speed_kmh: speedKmh,
    system_calculated_eta: eta.toISOString(),
    manual_override_eta: manualOverrideEta?.toISOString() ?? null,
    is_delayed: isDelayed,
    delay_paused_progress: delayPausedProgress,
    delay_pause_started_at: delayPauseStartedAt?.toISOString() ?? null,
    delay_pause_total_ms: 0,
    current_location_text: currentText,
    current_location_lat: currentLat,
    current_location_lng: currentLng,
    use_manual_position: false,
    notes: demo.notes ?? null,
    created_by: adminId,
    updated_by: adminId,
    is_archived: false,
  };

  const existing = await api(config, `/rest/v1/shipments?tracking_code=eq.${encodeURIComponent(demo.trackingCode)}&select=id`);
  let shipmentId;
  if (existing.ok && existing.data?.length) {
    shipmentId = existing.data[0].id;
    await clearShipmentChildren(config, shipmentId);
    await api(config, `/rest/v1/shipments?id=eq.${shipmentId}`, { method: "PATCH", body: JSON.stringify(shipmentPayload) });
  } else {
    const created = await api(config, "/rest/v1/shipments", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(shipmentPayload),
    });
    if (!created.ok) throw new Error(`Shipment create failed: ${JSON.stringify(created.data)}`);
    shipmentId = created.data[0]?.id ?? created.data.id;
  }

  const events = [
    {
      shipment_id: shipmentId,
      status_code: "booked",
      location_text: demo.origin,
      location_lat: route.origin_lat,
      location_lng: route.origin_lng,
      description: "Shipment booked",
      event_time: new Date(departTime.getTime() - 3600 * 1000).toISOString(),
    },
  ];

  if (demo.status !== "booked" && demo.status !== "delivered") {
    events.push(
      {
        shipment_id: shipmentId,
        status_code: "departed",
        location_text: demo.origin,
        location_lat: route.origin_lat,
        location_lng: route.origin_lng,
        description: "Departed origin facility",
        event_time: departTime.toISOString(),
      },
      {
        shipment_id: shipmentId,
        status_code: "in_transit",
        location_text: currentText,
        location_lat: currentLat,
        location_lng: currentLng,
        description: demo.delay ? "Shipment paused — delay active" : "Shipment in transit",
        event_time: time.hoursAgo(0.5).toISOString(),
      },
    );
  }

  if (demo.status === "delivered") {
    events.push(
      { shipment_id: shipmentId, status_code: "departed", location_text: demo.origin, event_time: departTime.toISOString() },
      { shipment_id: shipmentId, status_code: "in_transit", location_text: "In transit", event_time: new Date(departTime.getTime() + 3600 * 1000).toISOString() },
      {
        shipment_id: shipmentId,
        status_code: "arrived",
        location_text: demo.destination,
        location_lat: route.dest_lat,
        location_lng: route.dest_lng,
        event_time: new Date(departTime.getTime() + 3600 * 1000 * 2).toISOString(),
      },
      {
        shipment_id: shipmentId,
        status_code: "delivered",
        location_text: demo.destination,
        location_lat: route.dest_lat,
        location_lng: route.dest_lng,
        description: "Delivered to consignee",
        event_time: time.hoursAgo(2).toISOString(),
      },
    );
  }

  await api(config, "/rest/v1/timeline_events", { method: "POST", body: JSON.stringify(events) });

  if (demo.status !== "booked") {
    await api(config, "/rest/v1/location_logs", {
      method: "POST",
      body: JSON.stringify([
        {
          shipment_id: shipmentId,
          location_text: currentText,
          latitude: currentLat,
          longitude: currentLng,
          is_current: true,
          source: "gps",
          created_by: adminId,
        },
      ]),
    });
  }

  if (demo.delay && manualOverrideEta && delayPauseStartedAt) {
    await api(config, "/rest/v1/delays", {
      method: "POST",
      body: JSON.stringify([
        {
          shipment_id: shipmentId,
          reason: demo.delay.reason,
          old_eta: eta.toISOString(),
          new_eta: manualOverrideEta.toISOString(),
          status_at_delay: "in_transit",
          created_by: adminId,
          notified_customer: false,
        },
      ]),
    });
    await api(config, "/rest/v1/timeline_events", {
      method: "POST",
      body: JSON.stringify([
        {
          shipment_id: shipmentId,
          status_code: "in_transit",
          location_text: currentText,
          location_lat: currentLat,
          location_lng: currentLng,
          description: `Delay recorded: ${demo.delay.reason}`,
          is_delay_event: true,
          delay_reason: demo.delay.reason,
          event_time: delayPauseStartedAt.toISOString(),
        },
      ]),
    });
  }

  return { trackingCode: demo.trackingCode, distanceKm: route.distance_km, progress: Math.round(progress * 100) };
}

export async function seedDemoData(options = {}) {
  loadProjectEnv();
  const config = getSetupConfig();
  const log = options.silent ? () => {} : (msg) => console.log(msg);
  const force = options.force ?? false;

  if (!config.supabaseUrl || !config.serviceKey) {
    return { skipped: true, reason: "Missing Supabase credentials" };
  }

  if (!force && (await hasDemoData(config))) {
    log("Demo seed data already present — skipping.");
    return { alreadySeeded: true };
  }

  log("Seeding demo shipments (real routes via Google Maps)…");
  const adminId = await getAdminId(config);
  const modes = await getModes(config);
  const year = new Date().getFullYear();

  await api(config, "/rest/v1/tracking_code_counters", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([
      { tenant_id: config.tenantId, year, mode_letter: "R", last_seq: 3 },
      { tenant_id: config.tenantId, year, mode_letter: "A", last_seq: 2 },
      { tenant_id: config.tenantId, year, mode_letter: "S", last_seq: 1 },
      { tenant_id: config.tenantId, year, mode_letter: "L", last_seq: 1 },
    ]),
  });

  for (const route of DEMO_ROUTES) {
    await upsertRoute(config, modes[route.modeCode], route);
  }

  const now = new Date();
  const time = {
    now,
    hoursAgo: (h) => new Date(now.getTime() - h * 3600 * 1000),
    hoursFromNow: (h) => new Date(now.getTime() + h * 3600 * 1000),
  };

  for (const demo of DEMOS) {
    const result = await upsertDemoShipment(config, adminId, modes[demo.modeCode], demo, time);
    log(`  ${result.trackingCode} · ${result.distanceKm} km · ${result.progress}%`);
  }

  const keys = await api(config, `/rest/v1/api_keys?tenant_id=eq.${config.tenantId}&select=id`);
  if (keys.ok && !keys.data?.length) {
    const keyHash = createHash("sha256").update("tk_live_demo_website_key").digest("hex");
    await api(config, "/rest/v1/api_keys", {
      method: "POST",
      body: JSON.stringify([
        {
          tenant_id: config.tenantId,
          key_hash: keyHash,
          name: "Demo Website",
          permissions: ["read:shipments"],
          is_active: true,
        },
      ]),
    });
  }

  log(`Demo seed complete: ${DEMOS.length} shipments.`);
  return { seeded: true, count: DEMOS.length };
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  seedDemoData({ force: process.argv.includes("--force") })
    .then((r) => {
      if (r.skipped) console.warn(r.reason);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

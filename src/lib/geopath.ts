export type LatLng = [number, number];

export interface RoutePolylineData {
  points: LatLng[];
  distance_m: number;
  duration_s?: number;
  source: "google_directions" | "great_circle" | "manual";
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function buildGreatCircle(origin: LatLng, destination: LatLng, segments = 50): LatLng[] {
  const points: LatLng[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    points.push(interpolateGreatCircle(origin, destination, t));
  }
  return points;
}

function interpolateGreatCircle(origin: LatLng, destination: LatLng, t: number): LatLng {
  const [lat1, lng1] = origin;
  const [lat2, lng2] = destination;
  const phi1 = toRad(lat1);
  const lam1 = toRad(lng1);
  const phi2 = toRad(lat2);
  const lam2 = toRad(lng2);
  const delta = 2 * Math.asin(
    Math.sqrt(
      Math.sin((phi2 - phi1) / 2) ** 2 +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin((lam2 - lam1) / 2) ** 2,
    ),
  );
  if (delta === 0) return origin;
  const a = Math.sin((1 - t) * delta) / Math.sin(delta);
  const b = Math.sin(t * delta) / Math.sin(delta);
  const x = a * Math.cos(phi1) * Math.cos(lam1) + b * Math.cos(phi2) * Math.cos(lam2);
  const y = a * Math.cos(phi1) * Math.sin(lam1) + b * Math.cos(phi2) * Math.sin(lam2);
  const z = a * Math.sin(phi1) + b * Math.sin(phi2);
  return [(Math.atan2(z, Math.sqrt(x * x + y * y)) * 180) / Math.PI, (Math.atan2(y, x) * 180) / Math.PI];
}

export function polylineDistanceKm(points: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineKm(points[i], points[i + 1]);
  }
  return total;
}

export function positionOnPolyline(points: LatLng[], progress: number): LatLng {
  const p = Math.max(0, Math.min(1, progress));
  if (points.length === 0) return [0, 0];
  if (p === 0) return points[0];
  if (p === 1) return points[points.length - 1];
  const segmentLengths = points.slice(0, -1).map((pt, i) => haversineKm(pt, points[i + 1]));
  const total = segmentLengths.reduce((a, b) => a + b, 0);
  if (total === 0) return points[0];
  const target = total * p;
  let walked = 0;
  for (let i = 0; i < segmentLengths.length; i++) {
    const segLen = segmentLengths[i];
    if (walked + segLen >= target) {
      const t = (target - walked) / segLen;
      return lerp(points[i], points[i + 1], t);
    }
    walked += segLen;
  }
  return points[points.length - 1];
}

function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function headingDegrees(from: LatLng, to: LatLng): number {
  const dLng = toRad(to[1] - from[1]);
  const lat1 = toRad(from[0]);
  const lat2 = toRad(to[0]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function extractPolylinePoints(routePolyline: unknown): LatLng[] {
  if (!routePolyline || typeof routePolyline !== "object") return [];
  const data = routePolyline as { points?: LatLng[] };
  return Array.isArray(data.points) ? data.points : [];
}

function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

function geocodeFallback(address: string) {
  let hash = 0;
  for (let i = 0; i < address.length; i++) hash = (hash * 31 + address.charCodeAt(i)) >>> 0;
  return { lat: 47 + ((hash % 900) / 100), lng: 5 + (((hash >>> 10) % 2200) / 100) };
}

async function geocode(address: string, apiKey: string | undefined) {
  if (!apiKey) return geocodeFallback(address);
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString());
  const json = (await res.json()) as {
    results?: { geometry: { location: { lat: number; lng: number } } }[];
  };
  const loc = json.results?.[0]?.geometry.location;
  if (!loc) return geocodeFallback(address);
  return { lat: loc.lat, lng: loc.lng };
}

async function fetchGoogleDirections(
  origin: LatLng,
  destination: LatLng,
  travelMode: "driving" | "transit",
  apiKey: string | undefined,
): Promise<RoutePolylineData> {
  if (!apiKey) {
    const points = buildGreatCircle(origin, destination);
    return { points, distance_m: Math.round(polylineDistanceKm(points) * 1000), source: "great_circle" };
  }
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", `${origin[0]},${origin[1]}`);
  url.searchParams.set("destination", `${destination[0]},${destination[1]}`);
  url.searchParams.set("mode", travelMode);
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString());
  const json = (await res.json()) as {
    routes?: {
      legs?: { distance: { value: number }; duration: { value: number } }[];
      overview_polyline?: { points: string };
    }[];
  };
  const route = json.routes?.[0];
  if (!route?.overview_polyline?.points) {
    const points = buildGreatCircle(origin, destination);
    return { points, distance_m: Math.round(polylineDistanceKm(points) * 1000), source: "great_circle" };
  }
  const points = decodePolyline(route.overview_polyline.points);
  const leg = route.legs?.[0];
  return {
    points,
    distance_m: leg?.distance?.value ?? Math.round(polylineDistanceKm(points) * 1000),
    duration_s: leg?.duration?.value,
    source: "google_directions",
  };
}

const mapsKey = () => import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export async function estimateRoute(params: {
  origin: string;
  destination: string;
  modeCode: string;
  originLat?: number | null;
  originLng?: number | null;
  destLat?: number | null;
  destLng?: number | null;
  speedKmh?: number | null;
}) {
  let originLat = params.originLat ?? null;
  let originLng = params.originLng ?? null;
  let destLat = params.destLat ?? null;
  let destLng = params.destLng ?? null;
  const key = mapsKey();

  if (originLat === null || originLng === null) {
    const g = await geocode(params.origin, key);
    originLat = g.lat;
    originLng = g.lng;
  }
  if (destLat === null || destLng === null) {
    const g = await geocode(params.destination, key);
    destLat = g.lat;
    destLng = g.lng;
  }

  const origin: LatLng = [originLat, originLng];
  const destination: LatLng = [destLat, destLng];
  let data: RoutePolylineData;

  if (params.modeCode === "road" || params.modeCode === "rail") {
    data = await fetchGoogleDirections(origin, destination, params.modeCode === "rail" ? "transit" : "driving", key);
  } else {
    const points = buildGreatCircle(origin, destination);
    data = { points, distance_m: Math.round(polylineDistanceKm(points) * 1000), source: "great_circle" };
  }

  const distanceKm = data.distance_m / 1000;
  const durationHours =
    params.speedKmh && params.speedKmh > 0
      ? distanceKm / params.speedKmh
      : data.duration_s && data.duration_s > 0
        ? data.duration_s / 3600
        : distanceKm / 80;

  return {
    origin_lat: originLat,
    origin_lng: originLng,
    dest_lat: destLat,
    dest_lng: destLng,
    distance_km: Math.round(distanceKm * 100) / 100,
    duration_hours: Math.round(durationHours * 100) / 100,
    polyline_source: data.source,
    polyline: data,
  };
}

export async function ensureRoutePolyline(shipment: {
  id: string;
  origin: string;
  destination: string;
  origin_lat: number | null;
  origin_lng: number | null;
  dest_lat: number | null;
  dest_lng: number | null;
  distance_km: number | null;
  route_polyline: unknown;
  modes?: { code: string };
}, updateFn: (data: Record<string, unknown>) => Promise<void>): Promise<RoutePolylineData> {
  const existing = shipment.route_polyline as RoutePolylineData | null;
  const modeCode = shipment.modes?.code ?? "road";
  const key = mapsKey();

  if (existing?.points?.length) {
    const shouldRefresh =
      key && (modeCode === "road" || modeCode === "rail") && existing.source === "great_circle";
    if (!shouldRefresh) return existing;
  }

  let originLat = shipment.origin_lat;
  let originLng = shipment.origin_lng;
  let destLat = shipment.dest_lat;
  let destLng = shipment.dest_lng;

  if (originLat === null || originLng === null) {
    const g = await geocode(shipment.origin, key);
    originLat = g.lat;
    originLng = g.lng;
  }
  if (destLat === null || destLng === null) {
    const g = await geocode(shipment.destination, key);
    destLat = g.lat;
    destLng = g.lng;
  }

  const origin: LatLng = [originLat, originLng];
  const destination: LatLng = [destLat, destLng];
  let data: RoutePolylineData;

  if (modeCode === "road" || modeCode === "rail") {
    data = await fetchGoogleDirections(origin, destination, modeCode === "rail" ? "transit" : "driving", key);
  } else {
    const points = buildGreatCircle(origin, destination);
    data = { points, distance_m: Math.round(polylineDistanceKm(points) * 1000), source: "great_circle" };
  }

  const computedKm = data.distance_m / 1000;
  const distanceKm =
    data.source === "google_directions" && computedKm > 0
      ? computedKm
      : shipment.distance_km && shipment.distance_km > 0
        ? shipment.distance_km
        : computedKm;

  await updateFn({
    origin_lat: originLat,
    origin_lng: originLng,
    dest_lat: destLat,
    dest_lng: destLng,
    route_polyline: data,
    route_polyline_source: data.source,
    distance_km: distanceKm,
    geocoded_at: new Date().toISOString(),
  });

  return data;
}

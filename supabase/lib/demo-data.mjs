const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a, b) {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function interpolateGreatCircle(origin, destination, t) {
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

export function buildGreatCircle(origin, destination, segments = 50) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    points.push(interpolateGreatCircle(origin, destination, i / segments));
  }
  return points;
}

export function polylineDistanceKm(points) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineKm(points[i], points[i + 1]);
  }
  return total;
}

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function positionOnPolyline(points, progress) {
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
      return lerp(points[i], points[i + 1], (target - walked) / segLen);
    }
    walked += segLen;
  }
  return points[points.length - 1];
}

function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;
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

async function geocode(address, apiKey) {
  if (!apiKey) throw new Error(`GOOGLE_MAPS_API_KEY required to geocode "${address}"`);
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString());
  const json = await res.json();
  const loc = json.results?.[0]?.geometry?.location;
  if (!loc) throw new Error(`Geocoding failed for "${address}" (${json.status ?? "unknown"})`);
  return { lat: loc.lat, lng: loc.lng };
}

async function fetchGoogleDirections(origin, destination, travelMode, apiKey) {
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
  const json = await res.json();
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

export async function resolveDemoRoute({ origin, destination, modeCode, originLat, originLng, destLat, destLng }) {
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
  let oLat = originLat ?? null;
  let oLng = originLng ?? null;
  let dLat = destLat ?? null;
  let dLng = destLng ?? null;
  if (oLat === null || oLng === null) {
    const g = await geocode(origin, apiKey);
    oLat = g.lat;
    oLng = g.lng;
  }
  if (dLat === null || dLng === null) {
    const g = await geocode(destination, apiKey);
    dLat = g.lat;
    dLng = g.lng;
  }
  const o = [oLat, oLng];
  const d = [dLat, dLng];
  let polyline;
  if (modeCode === "road") {
    polyline = await fetchGoogleDirections(o, d, "driving", apiKey);
  } else if (modeCode === "rail") {
    polyline = await fetchGoogleDirections(o, d, "transit", apiKey);
  } else {
    const points = buildGreatCircle(o, d);
    polyline = { points, distance_m: Math.round(polylineDistanceKm(points) * 1000), source: "great_circle" };
  }
  return {
    origin_lat: oLat,
    origin_lng: oLng,
    dest_lat: dLat,
    dest_lng: dLng,
    distance_km: Math.round((polyline.distance_m / 1000) * 100) / 100,
    polyline,
    polyline_source: polyline.source,
  };
}

export function calculateSystemEta(mode, distanceKm, departTime, speedKmhOverride) {
  const speedKmh = speedKmhOverride ?? Number(mode.default_speed_kmh);
  const handlingOrigin = mode.handling_hours_origin;
  const handlingDest = mode.handling_hours_dest;
  const restPerKm = Number(mode.rest_break_hours_per_km) ?? 0;
  let travelHours = speedKmh > 0 ? distanceKm / speedKmh : 0;
  let restBreakHours = 0;
  switch (mode.code) {
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
      travelHours = (distanceKm / 1.852) / 15;
      restBreakHours = distanceKm * (restPerKm || 0.002);
      break;
  }
  const baseHours =
    travelHours + restBreakHours + handlingOrigin + handlingDest + (mode.code === "sea" ? 48 - handlingOrigin - handlingDest : 0);
  const eta = new Date(departTime.getTime() + baseHours * 3600 * 1000);
  return { eta, speedKmh };
}

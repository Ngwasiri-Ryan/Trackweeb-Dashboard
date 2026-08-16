import {
  Map,
  Marker,
  Polyline,
  useMap,
} from "@vis.gl/react-google-maps";
import { useEffect, useMemo } from "react";
import type { LiveMapItem } from "@/lib/types";
import {
  type RouteMotionInput,
  ROUTE_VISUAL_PROGRESS_PER_SEC,
  useAnimatedRoutePosition,
} from "@/lib/route-motion";
import { GoogleMapsShell } from "../maps/google-maps-shell";

type LatLng = { lat: number; lng: number };

const CURRENT_COLOR = "#e2601a";
const DELAYED_COLOR = "#d97706";

const MODE_ROUTE_STYLE: Record<
  string,
  { strokeColor: string; strokeWeight: number; dashed: boolean }
> = {
  road: { strokeColor: "#0d9488", strokeWeight: 4, dashed: false },
  rail: { strokeColor: "#5b21b6", strokeWeight: 4, dashed: false },
  air: { strokeColor: "#2563eb", strokeWeight: 3, dashed: true },
  sea: { strokeColor: "#0369a1", strokeWeight: 3, dashed: true },
};

const DASH_ICONS = [
  {
    icon: {
      path: "M 0,-1 0,1",
      strokeOpacity: 1,
      scale: 3,
    },
    offset: "0",
    repeat: "16px",
  },
];

function fitMapToPoints(map: google.maps.Map, points: LatLng[], padding = 40) {
  if (points.length === 0) return;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  map.fitBounds(
    {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs),
    },
    padding,
  );
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;
    fitMapToPoints(map, points, 40);
  }, [map, points]);

  return null;
}

function RouteLine({
  path,
  modeCode,
  polylineSource,
}: {
  path: LatLng[];
  modeCode: string;
  polylineSource: string;
}) {
  const style = MODE_ROUTE_STYLE[modeCode] ?? MODE_ROUTE_STYLE.road!;
  const isDirections = polylineSource === "google_directions";

  return (
    <Polyline
      path={path}
      strokeColor={style.strokeColor}
      strokeWeight={style.strokeWeight}
      strokeOpacity={0.9}
      icons={style.dashed && !isDirections ? DASH_ICONS : undefined}
    />
  );
}

function AnimatedPackageDot({
  motionInput,
  label,
  isDelayed = false,
  onClick,
}: {
  motionInput: RouteMotionInput;
  label: string | null;
  isDelayed?: boolean;
  onClick?: () => void;
}) {
  const { position, heading } = useAnimatedRoutePosition(motionInput);
  const dotColor = isDelayed ? DELAYED_COLOR : CURRENT_COLOR;

  return (
    <>
      <Marker
        position={position}
        zIndex={999}
        onClick={onClick}
        icon={{
          path: 0,
          scale: 18,
          fillColor: dotColor,
          fillOpacity: isDelayed ? 0.28 : 0.18,
          strokeWeight: 0,
        }}
      />
      <Marker
        position={position}
        title={label ?? (isDelayed ? "Delayed — holding position" : "Package in transit")}
        zIndex={1000}
        onClick={onClick}
        icon={{
          path: 0,
          scale: isDelayed ? 12 : 11,
          fillColor: dotColor,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
          rotation: isDelayed ? 0 : (heading ?? 0),
        }}
      />
    </>
  );
}

function LiveMapShipmentLayer({
  item,
  selected,
  onSelect,
}: {
  item: LiveMapItem;
  selected: boolean;
  onSelect?: (id: string) => void;
}) {
  const viewStartTime = useMemo(() => Date.now(), []);

  const path = useMemo(
    () =>
      item.geopath && item.geopath.length >= 2
        ? item.geopath
        : [
            { lat: item.origin_lat, lng: item.origin_lng },
            { lat: item.current_location_lat, lng: item.current_location_lng },
            { lat: item.dest_lat, lng: item.dest_lng },
          ],
    [item],
  );

  const delayed = item.is_delayed || item.motion?.position_source === "delayed";

  const motionInput = useMemo<RouteMotionInput>(
    () => ({
      geopath: path,
      departTime: item.depart_time,
      speedKmh: item.speed_kmh ?? 80,
      status: item.status,
      isMoving: delayed ? false : (item.motion?.is_moving ?? (item.status === "in_transit" || item.status === "departed")),
      isDelayed: delayed,
      pausedProgress: delayed ? item.progress_percent / 100 : null,
      positionSource: delayed ? "delayed" : (item.motion?.position_source ?? "simulated"),
      serverPosition: { lat: item.current_location_lat, lng: item.current_location_lng },
      viewStartTime,
      visualProgressPerSec:
        delayed || item.motion?.position_source === "manual" ? 0 : ROUTE_VISUAL_PROGRESS_PER_SEC,
    }),
    [path, item, delayed, viewStartTime],
  );

  const polylineSource = item.polyline_source ?? "great_circle";
  const canAnimate =
    !delayed &&
    item.status !== "booked" &&
    (item.motion?.is_moving ?? (item.status === "in_transit" || item.status === "departed"));

  return (
    <>
      <RouteLine path={path} modeCode={item.mode.code} polylineSource={polylineSource} />
      <Marker
        position={{ lat: item.origin_lat, lng: item.origin_lng }}
        title={`Origin · ${item.origin}`}
        opacity={selected ? 1 : 0.85}
      />
      <Marker
        position={{ lat: item.dest_lat, lng: item.dest_lng }}
        title={`Destination · ${item.destination}`}
        opacity={selected ? 1 : 0.85}
      />
      {canAnimate ? (
        <AnimatedPackageDot
          motionInput={motionInput}
          label={`${item.tracking_code} · ${item.current_location_text ?? "In transit"} · ${Math.round(item.progress_percent)}%`}
          isDelayed={delayed}
          onClick={onSelect ? () => onSelect(item.id) : undefined}
        />
      ) : (
        <Marker
          position={{ lat: item.current_location_lat, lng: item.current_location_lng }}
          title={`${item.tracking_code} · ${item.current_location_text ?? "In transit"} · ${Math.round(item.progress_percent)}%`}
          onClick={onSelect ? () => onSelect(item.id) : undefined}
          icon={{
            path: 0,
            scale: selected ? 10 : 7,
            fillColor: delayed ? DELAYED_COLOR : CURRENT_COLOR,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          }}
        />
      )}
    </>
  );
}

export function AdminLiveMap({
  items,
  selectedId,
  onSelect,
  height = "420px",
}: {
  items: LiveMapItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  height?: string;
}) {
  if (items.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground"
        style={{ height }}
      >
        No active shipments to display on the map.
      </div>
    );
  }

  const first = items[0]!;
  const center = { lat: first.current_location_lat, lng: first.current_location_lng };
  const allPoints = items.flatMap((s) => [
    { lat: s.origin_lat, lng: s.origin_lng },
    { lat: s.current_location_lat, lng: s.current_location_lng },
    { lat: s.dest_lat, lng: s.dest_lng },
  ]);

  return (
    <GoogleMapsShell height={height}>
      <Map
        defaultCenter={center}
        defaultZoom={5}
        gestureHandling="greedy"
        mapTypeId="roadmap"
        style={{ width: "100%", height: "100%" }}
      >
        <FitBounds points={allPoints} />
        {items.map((s) => (
          <LiveMapShipmentLayer
            key={s.id}
            item={s}
            selected={s.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </Map>
    </GoogleMapsShell>
  );
}

export function ShipmentLiveMap({
  origin,
  destination,
  current,
  geopath = [],
  height = "360px",
  modeCode = "road",
  polylineSource = "great_circle",
  status = "in_transit",
  departTime,
  speedKmh = 80,
  animate = true,
  progressPercent = 0,
  isDelayed = false,
  motion,
}: {
  origin: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number; label: string };
  current: { lat: number; lng: number; label: string | null };
  geopath?: { lat: number; lng: number }[];
  height?: string;
  modeCode?: string;
  polylineSource?: "google_directions" | "great_circle" | "manual";
  status?: string;
  departTime?: string;
  speedKmh?: number;
  animate?: boolean;
  progressPercent?: number;
  isDelayed?: boolean;
  motion?: {
    is_moving: boolean;
    is_delayed?: boolean;
    position_source: "simulated" | "manual" | "delayed";
    remaining_hours?: number | null;
  };
}) {
  const viewStartTime = useMemo(() => Date.now(), []);

  const path = useMemo(
    () =>
      geopath.length > 0
        ? geopath.map((p) => ({ lat: p.lat, lng: p.lng }))
        : [
            { lat: origin.lat, lng: origin.lng },
            { lat: current.lat, lng: current.lng },
            { lat: destination.lat, lng: destination.lng },
          ],
    [geopath, origin.lat, origin.lng, destination.lat, destination.lng, current.lat, current.lng],
  );

  const delayed = isDelayed || motion?.is_delayed || motion?.position_source === "delayed";

  const motionInput = useMemo<RouteMotionInput>(
    () => ({
      geopath: path,
      departTime: departTime ?? new Date().toISOString(),
      speedKmh,
      status,
      isMoving: delayed ? false : (motion?.is_moving ?? (status === "in_transit" || status === "departed")),
      isDelayed: delayed,
      pausedProgress: delayed ? progressPercent / 100 : null,
      positionSource: delayed ? "delayed" : (motion?.position_source ?? "simulated"),
      manualPosition:
        motion?.position_source === "manual"
          ? { lat: current.lat, lng: current.lng }
          : null,
      serverPosition: { lat: current.lat, lng: current.lng },
      viewStartTime,
      visualProgressPerSec:
        delayed || motion?.position_source === "manual" ? 0 : ROUTE_VISUAL_PROGRESS_PER_SEC,
    }),
    [
      path,
      departTime,
      speedKmh,
      status,
      delayed,
      progressPercent,
      motion?.is_moving,
      motion?.position_source,
      current.lat,
      current.lng,
      viewStartTime,
    ],
  );

  const center = { lat: current.lat, lng: current.lng };
  const modeLabel =
    modeCode === "road"
      ? "Road route"
      : modeCode === "rail"
        ? "Rail route"
        : modeCode === "air"
          ? "Air route"
          : modeCode === "sea"
            ? "Sea route"
            : "Route";

  return (
    <div className="shipment-map-panel w-full min-w-0">
      <GoogleMapsShell height={height} className="w-full">
        <Map
          defaultCenter={center}
          defaultZoom={6}
          gestureHandling="greedy"
          mapTypeId="roadmap"
          style={{ width: "100%", height: "100%" }}
        >
          <FitBounds points={path} />
          <RouteLine path={path} modeCode={modeCode} polylineSource={polylineSource} />
          <Marker
            position={{ lat: origin.lat, lng: origin.lng }}
            title={`Origin · ${origin.label}`}
            label={{ text: "A", color: "#ffffff", fontWeight: "700" }}
          />
          <Marker
            position={{ lat: destination.lat, lng: destination.lng }}
            title={`Destination · ${destination.label}`}
            label={{ text: "B", color: "#ffffff", fontWeight: "700" }}
          />
          {animate ? (
            <AnimatedPackageDot motionInput={motionInput} label={current.label} isDelayed={delayed} />
          ) : (
            <Marker
              position={{ lat: current.lat, lng: current.lng }}
              title={current.label ?? "Current position"}
              icon={{
                path: 0,
                scale: 9,
                fillColor: CURRENT_COLOR,
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 3,
              }}
            />
          )}
        </Map>
      </GoogleMapsShell>
      <p className="mt-2 text-center text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {modeLabel}
        {polylineSource === "google_directions" ? " · Google Maps" : " · Great-circle path"}
        {delayed ? " · Paused (delay)" : animate && motionInput.isMoving ? " · Live simulation" : ""}
      </p>
    </div>
  );
}

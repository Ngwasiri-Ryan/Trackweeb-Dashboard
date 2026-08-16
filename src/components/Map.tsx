import { APIProvider, Map as GMap, Marker, Polyline } from "@vis.gl/react-google-maps";

type Point = { lat: number; lng: number; label?: string | null };

type Props = {
  origin: Point;
  destination: Point;
  position?: Point;
  polyline?: [number, number][];
  height?: number;
};

export function ShipmentMap({ origin, destination, position, polyline, height = 400 }: Props) {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const center = position ?? origin;
  const path = polyline?.map(([lat, lng]) => ({ lat, lng })) ?? [origin, destination];

  if (!key) {
    return (
      <div className="map-container" style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        Set VITE_GOOGLE_MAPS_API_KEY for map
      </div>
    );
  }

  return (
    <div className="map-container" style={{ height }}>
      <APIProvider apiKey={key}>
        <GMap defaultCenter={center} defaultZoom={5} gestureHandling="greedy" disableDefaultUI>
          <Marker position={origin} title={origin.label ?? "Origin"} />
          <Marker position={destination} title={destination.label ?? "Destination"} />
          {position && <Marker position={position} title={position.label ?? "Current"} />}
          {path.length > 1 && <Polyline path={path} strokeColor="#0066cc" strokeWeight={3} />}
        </GMap>
      </APIProvider>
    </div>
  );
}

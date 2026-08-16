export type ShipmentStatus = "booked" | "departed" | "in_transit" | "arrived" | "delivered";
export type ModeCode = "road" | "air" | "sea" | "rail";
export type ServiceType = "standard" | "express" | "economy" | "priority";

export type Mode = {
  id: string;
  code: ModeCode;
  display_name: string;
  icon: string | null;
  default_speed_kmh: number;
  handling_hours_origin: number;
  handling_hours_dest: number;
  rest_break_hours_per_km: number;
  is_active: boolean;
};

export type Status = {
  id: string;
  code: string;
  display_name: string;
  step_order: number;
  color_hex: string;
  is_terminal: boolean;
};

export type ShipmentRow = {
  id: string;
  tenant_id: string;
  tracking_code: string;
  customer_reference: string | null;
  mode_id: string;
  status: ShipmentStatus;
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
  route_polyline: unknown;
  route_polyline_source: string | null;
  shipping_date: string | null;
  depart_time: string;
  weight_kg: number | null;
  speed_kmh: number | null;
  service_type: ServiceType;
  parcel_quantity: number;
  parcel_dimensions: unknown;
  system_calculated_eta: string;
  manual_override_eta: string | null;
  is_delayed: boolean;
  delay_paused_progress: number | null;
  delay_pause_started_at: string | null;
  delay_pause_total_ms: number;
  current_location_text: string | null;
  current_location_lat: number | null;
  current_location_lng: number | null;
  use_manual_position: boolean;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  modes?: Mode;
};

export type TimelineEvent = {
  id: string;
  shipment_id: string;
  status_code: ShipmentStatus;
  location_text: string | null;
  location_lat: number | null;
  location_lng: number | null;
  description: string | null;
  is_delay_event: boolean;
  delay_reason: string | null;
  event_time: string;
  created_at: string;
};

export type Delay = {
  id: string;
  shipment_id: string;
  reason: string;
  old_eta: string;
  new_eta: string;
  status_at_delay: ShipmentStatus;
  created_by: string;
  created_at: string;
  notified_customer: boolean;
};

export type LocationLog = {
  id: string;
  shipment_id: string;
  location_text: string;
  latitude: number | null;
  longitude: number | null;
  is_current: boolean;
  source: string;
  created_at: string;
};

export type LiveMapItem = {
  id: string;
  tracking_code: string;
  status: string;
  is_delayed: boolean;
  receiver_name: string;
  origin: string;
  origin_lat: number;
  origin_lng: number;
  destination: string;
  dest_lat: number;
  dest_lng: number;
  current_location_text: string | null;
  current_location_lat: number;
  current_location_lng: number;
  final_eta: string;
  depart_time: string;
  mode: { code: string; display_name: string; icon: string };
  progress_percent: number;
  /** Full route path for live animation */
  geopath?: { lat: number; lng: number }[];
  speed_kmh?: number;
  polyline_source?: "google_directions" | "great_circle" | "manual";
  motion?: {
    is_moving: boolean;
    is_delayed?: boolean;
    position_source: "simulated" | "manual" | "delayed";
    remaining_hours?: number | null;
  };
};

export type Route = {
  id: string;
  tenant_id: string;
  mode_id: string;
  origin: string;
  destination: string;
  distance_km: number;
  default_duration_hours: number;
  is_active: boolean;
  created_at: string;
  modes?: { code: string; display_name: string };
};

export type Tenant = {
  id: string;
  name: string;
  subdomain: string;
  logo_url: string | null;
  timezone: string;
  is_active: boolean;
};

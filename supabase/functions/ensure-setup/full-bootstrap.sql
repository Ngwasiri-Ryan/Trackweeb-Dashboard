-- Trackweeb schema for Supabase (migrated from Prisma)

CREATE TYPE shipment_status AS ENUM ('booked', 'departed', 'in_transit', 'arrived', 'delivered');
CREATE TYPE mode_code AS ENUM ('road', 'air', 'sea', 'rail');
CREATE TYPE service_type AS ENUM ('standard', 'express', 'economy', 'priority');
CREATE TYPE route_polyline_source AS ENUM ('google_directions', 'great_circle', 'manual');
CREATE TYPE location_source AS ENUM ('manual', 'gps', 'api');
CREATE TYPE user_role AS ENUM ('admin');

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  subdomain varchar(50) NOT NULL UNIQUE,
  logo_url text,
  timezone varchar(50) NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  full_name varchar(100) NOT NULL,
  role user_role NOT NULL DEFAULT 'admin',
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code mode_code NOT NULL UNIQUE,
  display_name varchar(50) NOT NULL,
  icon varchar(50),
  default_speed_kmh decimal(10,2) NOT NULL,
  handling_hours_origin int NOT NULL DEFAULT 0,
  handling_hours_dest int NOT NULL DEFAULT 0,
  rest_break_hours_per_km decimal(10,6) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(20) NOT NULL UNIQUE,
  display_name varchar(50) NOT NULL,
  step_order int NOT NULL,
  color_hex varchar(7) NOT NULL DEFAULT '#6c757d',
  is_terminal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  mode_id uuid NOT NULL REFERENCES modes(id),
  origin varchar(200) NOT NULL,
  destination varchar(200) NOT NULL,
  distance_km decimal(12,2) NOT NULL,
  default_duration_hours decimal(10,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX routes_tenant_mode_idx ON routes(tenant_id, mode_id, is_active);

CREATE TABLE shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  tracking_code varchar(50) NOT NULL UNIQUE,
  customer_reference varchar(50),
  mode_id uuid NOT NULL REFERENCES modes(id),
  status shipment_status NOT NULL,
  receiver_name varchar(200) NOT NULL,
  receiver_phone varchar(20),
  receiver_email varchar(100),
  sender_name varchar(200) NOT NULL,
  sender_phone varchar(20),
  origin varchar(200) NOT NULL,
  origin_lat decimal(10,8),
  origin_lng decimal(11,8),
  destination varchar(200) NOT NULL,
  dest_lat decimal(10,8),
  dest_lng decimal(11,8),
  distance_km decimal(12,2),
  route_polyline jsonb,
  route_polyline_source route_polyline_source,
  geocoded_at timestamptz,
  shipping_date timestamptz,
  depart_time timestamptz NOT NULL,
  weight_kg decimal(10,2),
  speed_kmh decimal(10,2),
  service_type service_type NOT NULL DEFAULT 'standard',
  parcel_quantity int NOT NULL DEFAULT 1,
  parcel_dimensions jsonb,
  system_calculated_eta timestamptz NOT NULL,
  manual_override_eta timestamptz,
  is_delayed boolean NOT NULL DEFAULT false,
  delay_paused_progress decimal(8,6),
  delay_pause_started_at timestamptz,
  delay_pause_total_ms int NOT NULL DEFAULT 0,
  current_location_text text,
  current_location_lat decimal(10,8),
  current_location_lng decimal(11,8),
  use_manual_position boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false
);

CREATE INDEX shipments_tracking_code_idx ON shipments(tracking_code);
CREATE INDEX shipments_tenant_status_idx ON shipments(tenant_id, status, depart_time);
CREATE INDEX shipments_tenant_archived_idx ON shipments(tenant_id, is_archived, depart_time);
CREATE INDEX shipments_receiver_email_idx ON shipments(receiver_email);

CREATE TABLE timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status_code shipment_status NOT NULL,
  location_text text,
  location_lat decimal(10,8),
  location_lng decimal(11,8),
  description text,
  is_delay_event boolean NOT NULL DEFAULT false,
  delay_reason text,
  event_time timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX timeline_events_shipment_time_idx ON timeline_events(shipment_id, event_time DESC);

CREATE TABLE delays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  reason text NOT NULL,
  old_eta timestamptz NOT NULL,
  new_eta timestamptz NOT NULL,
  status_at_delay shipment_status NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_customer boolean NOT NULL DEFAULT false
);

CREATE INDEX delays_shipment_created_idx ON delays(shipment_id, created_at DESC);

CREATE TABLE location_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  location_text text NOT NULL,
  latitude decimal(10,8),
  longitude decimal(11,8),
  is_current boolean NOT NULL DEFAULT false,
  source location_source NOT NULL DEFAULT 'manual',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX location_logs_shipment_created_idx ON location_logs(shipment_id, created_at DESC);
CREATE INDEX location_logs_shipment_current_idx ON location_logs(shipment_id, is_current);

CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  key_hash varchar(255) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  permissions jsonb NOT NULL DEFAULT '["read:shipments"]',
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX api_keys_tenant_active_idx ON api_keys(tenant_id, is_active);

CREATE TABLE tracking_code_counters (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  year smallint NOT NULL,
  mode_letter char(1) NOT NULL,
  last_seq int NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, year, mode_letter)
);

CREATE TABLE contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  name varchar(200) NOT NULL,
  email varchar(100) NOT NULL,
  phone varchar(20),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER shipments_updated_at BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- RLS policies and helper functions

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE delays ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_code_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Helper: current user's tenant
CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$;

-- Tracking code generation (atomic)
CREATE OR REPLACE FUNCTION generate_tracking_code(p_mode_code mode_code)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_year int;
  v_letter char(1);
  v_seq int;
BEGIN
  v_tenant_id := auth_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_year := EXTRACT(YEAR FROM now())::int;
  v_letter := CASE p_mode_code
    WHEN 'road' THEN 'R'
    WHEN 'air' THEN 'A'
    WHEN 'sea' THEN 'S'
    WHEN 'rail' THEN 'L'
  END;

  INSERT INTO tracking_code_counters (tenant_id, year, mode_letter, last_seq)
  VALUES (v_tenant_id, v_year, v_letter, 1)
  ON CONFLICT (tenant_id, year, mode_letter)
  DO UPDATE SET last_seq = tracking_code_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  IF v_seq > 999999 THEN
    RAISE EXCEPTION 'Tracking code sequence exhausted';
  END IF;

  RETURN 'TRK-' || v_year || '-' || v_letter || '-' || lpad(v_seq::text, 6, '0');
END;
$$;

-- Profiles
CREATE POLICY profiles_select_own ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY profiles_update_own ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Lookups (read-only for all authenticated)
CREATE POLICY modes_read ON modes FOR SELECT TO authenticated USING (true);
CREATE POLICY modes_read_anon ON modes FOR SELECT TO anon USING (true);
CREATE POLICY statuses_read ON statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY statuses_read_anon ON statuses FOR SELECT TO anon USING (true);

-- Tenants
CREATE POLICY tenants_read ON tenants FOR SELECT TO authenticated
  USING (id = auth_tenant_id());
CREATE POLICY tenants_update ON tenants FOR UPDATE TO authenticated
  USING (id = auth_tenant_id());

-- Routes
CREATE POLICY routes_tenant ON routes FOR ALL TO authenticated
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- Shipments (admin)
CREATE POLICY shipments_tenant ON shipments FOR ALL TO authenticated
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- Public read by tracking code only (anon can read non-archived)
CREATE POLICY shipments_public_read ON shipments FOR SELECT TO anon
  USING (is_archived = false);

-- Timeline, delays, location logs (admin via shipment tenant)
CREATE POLICY timeline_tenant ON timeline_events FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM shipments s WHERE s.id = shipment_id AND s.tenant_id = auth_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM shipments s WHERE s.id = shipment_id AND s.tenant_id = auth_tenant_id()
  ));

CREATE POLICY timeline_public_read ON timeline_events FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM shipments s WHERE s.id = shipment_id AND s.is_archived = false
  ));

CREATE POLICY delays_tenant ON delays FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM shipments s WHERE s.id = shipment_id AND s.tenant_id = auth_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM shipments s WHERE s.id = shipment_id AND s.tenant_id = auth_tenant_id()
  ));

CREATE POLICY location_logs_tenant ON location_logs FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM shipments s WHERE s.id = shipment_id AND s.tenant_id = auth_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM shipments s WHERE s.id = shipment_id AND s.tenant_id = auth_tenant_id()
  ));

CREATE POLICY location_logs_public_read ON location_logs FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM shipments s WHERE s.id = shipment_id AND s.is_archived = false
  ));

-- API keys
CREATE POLICY api_keys_tenant ON api_keys FOR ALL TO authenticated
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- Counters (via RPC only)
CREATE POLICY counters_tenant ON tracking_code_counters FOR ALL TO authenticated
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- Contact messages
CREATE POLICY contact_insert_anon ON contact_messages FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY contact_read_tenant ON contact_messages FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = auth_tenant_id());

GRANT EXECUTE ON FUNCTION generate_tracking_code(mode_code) TO authenticated;
-- Seed lookup data and default tenant
-- Admin user: run `npm run setup:admin` (see README) or create manually in Supabase Auth.

INSERT INTO tenants (id, name, subdomain, timezone, logo_url)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Logistics Inc',
  'logistics-inc',
  'Europe/London',
  NULL
) ON CONFLICT (subdomain) DO UPDATE SET
  name = EXCLUDED.name,
  timezone = EXCLUDED.timezone;

INSERT INTO modes (code, display_name, icon, default_speed_kmh, handling_hours_origin, handling_hours_dest, rest_break_hours_per_km) VALUES
  ('road', 'Road Freight', 'truck', 80, 2, 1, 0.00015),
  ('air', 'Air Cargo', 'plane', 850, 4, 3, 0),
  ('sea', 'Sea Freight', 'ship', 27.8, 24, 24, 0.002),
  ('rail', 'Rail Freight', 'train', 120, 3, 2, 0.00005)
ON CONFLICT (code) DO NOTHING;

INSERT INTO statuses (code, display_name, step_order, color_hex, is_terminal) VALUES
  ('booked', 'Booked', 1, '#17a2b8', false),
  ('departed', 'Departed', 2, '#007bff', false),
  ('in_transit', 'In Transit', 3, '#ffc107', false),
  ('arrived', 'Arrived', 4, '#28a745', false),
  ('delivered', 'Delivered', 5, '#6c757d', true)
ON CONFLICT (code) DO NOTHING;

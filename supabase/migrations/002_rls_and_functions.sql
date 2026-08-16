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

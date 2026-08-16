-- Optional demo shipments (run after seed.sql and creating admin profile)

INSERT INTO routes (tenant_id, mode_id, origin, destination, distance_km, default_duration_hours)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  m.id,
  r.origin,
  r.destination,
  r.distance_km,
  r.duration_hours
FROM (VALUES
  ('road', 'Paris, France', 'Munich, Germany', 840, 10.5),
  ('rail', 'London St Pancras International, UK', 'Paris Gare du Nord, France', 456, 3.8),
  ('air', 'London Heathrow Airport, UK', 'John F Kennedy International Airport, New York, USA', 5540, 7.5),
  ('sea', 'Port of Rotterdam, Netherlands', 'Port of Hamburg, Germany', 380, 15)
) AS r(mode_code, origin, destination, distance_km, duration_hours)
JOIN modes m ON m.code = r.mode_code::mode_code
ON CONFLICT DO NOTHING;

INSERT INTO tracking_code_counters (tenant_id, year, mode_letter, last_seq) VALUES
  ('a0000000-0000-4000-8000-000000000001', 2026, 'R', 3),
  ('a0000000-0000-4000-8000-000000000001', 2026, 'A', 2),
  ('a0000000-0000-4000-8000-000000000001', 2026, 'S', 1),
  ('a0000000-0000-4000-8000-000000000001', 2026, 'L', 1)
ON CONFLICT DO NOTHING;

INSERT INTO shipments (
  tenant_id, tracking_code, mode_id, status,
  receiver_name, receiver_email, sender_name,
  origin, destination, distance_km,
  depart_time, system_calculated_eta,
  speed_kmh, current_location_text, is_archived
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'RYAN-EU-DEMO-001',
  m.id,
  'in_transit',
  'Ryan Ngwasiri',
  'ryanngwasiri@gmail.com',
  'Trackweeb Demo Logistics',
  'Paris, France',
  'Munich, Germany',
  840,
  now() - interval '3 hours',
  now() + interval '7 hours',
  80,
  'Near Strasbourg, France',
  false
FROM modes m WHERE m.code = 'road'
ON CONFLICT (tracking_code) DO NOTHING;

INSERT INTO timeline_events (shipment_id, status_code, location_text, description, event_time)
SELECT s.id, 'booked', s.origin, 'Shipment booked', s.depart_time - interval '1 hour'
FROM shipments s WHERE s.tracking_code = 'RYAN-EU-DEMO-001';

INSERT INTO timeline_events (shipment_id, status_code, location_text, description, event_time)
SELECT s.id, 'in_transit', 'Near Strasbourg, France', 'In transit', now() - interval '2 hours'
FROM shipments s WHERE s.tracking_code = 'RYAN-EU-DEMO-001';

INSERT INTO shipments (
  tenant_id, tracking_code, mode_id, status,
  receiver_name, receiver_email, sender_name,
  origin, destination, distance_km,
  depart_time, system_calculated_eta,
  speed_kmh, current_location_text, customer_reference, is_archived
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'TRK-2026-R-000001',
  m.id,
  'in_transit',
  'Acme Corp',
  'receiving@acme.com',
  'Supplier GmbH',
  'Berlin, Germany',
  'Hamburg, Germany',
  290,
  now() - interval '2 hours',
  now() + interval '2 hours',
  80,
  'Near Hanover, Germany',
  'PO-88421',
  false
FROM modes m WHERE m.code = 'road'
ON CONFLICT (tracking_code) DO NOTHING;

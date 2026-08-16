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

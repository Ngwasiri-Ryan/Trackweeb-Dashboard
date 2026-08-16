# Trackweeb Dashboard

Admin app + Supabase migrations. No NestJS backend — all data access runs through Supabase.

See [../BRANDING.md](../BRANDING.md) for per-client env-driven branding.

## Structure

```
trackweeb-dashboard/   Admin app + Supabase (deploy to Vercel)
trackweeb-site/        Public tracking site (deploy to Cloudflare/Vercel)
Tracking-Backend/      Legacy — no longer required for hosting
Tracking-Admin/        Legacy — replaced by trackweeb-dashboard
Tracking website/      Original public site (reference UI)
```

## Setup

### 1. Environment

Copy `.env.example` to `.env` and fill in brand + Supabase vars.

| Variable | Purpose |
|----------|---------|
| `VITE_APP_NAME` | Client brand name (build-time) |
| `VITE_SITE_URL` | Public site URL (receipts, SEO) |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps |
| `APP_NAME` | Email copy (runtime / edge) |
| `RESEND_API_KEY` | Email (Edge Function secret) |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-setup only (server-side, never `VITE_`) |
| `SUPABASE_DB_PASSWORD` | Auto-setup only (creates tables on first run) |

Default admin (created automatically if missing):

| Field | Value |
|-------|-------|
| Email | `admin@trackweeb.cm` |
| Password | `admin123` |
| Tenant | Logistics Inc (`logistics-inc`) |

### 2. Auto-setup (first run)

On **`npm run dev`**, a setup script runs automatically:

1. Checks if the tenant + admin already exist in Supabase
2. If not, applies schema/seed SQL and creates the admin user
3. If already provisioned, **does nothing**

```bash
cd trackweeb-dashboard
cp .env.example .env
npm run dev
```

Manual re-run: `npm run setup`

### 3. Run locally

```bash
cd trackweeb-dashboard && npm install && npm run dev   # http://localhost:5174
cd trackweeb-site     && npm install && npm run dev   # http://localhost:5175
```

### 4. Deploy Edge Functions (production)

```bash
supabase link --project-ref YOUR_REF
supabase secrets set \
  APP_NAME=Trackweeb \
  RESEND_API_KEY=... \
  RESEND_FROM_EMAIL="Trackweeb <onboarding@resend.dev>" \
  SUPPORT_EMAIL=... \
  SUPABASE_DB_PASSWORD=... \
  ADMIN_EMAIL=admin@trackweeb.cm \
  ADMIN_PASSWORD=admin123
supabase functions deploy send-email
supabase functions deploy ensure-setup
```

### 5. Deploy to Vercel / Cloudflare

- Import each folder as a separate project
- Root directory: `trackweeb-dashboard` or `trackweeb-site`
- Set all env vars from `.env.example` before build

## Business logic

Ported from the NestJS backend into `src/lib/*`:

- `eta.ts`, `geopath.ts`, `live-tracking.ts`, `shipments-service.ts`

Public site uses Supabase directly in `trackweeb-site/src/lib/track-service.ts`.

## Email (Resend via Edge Function)

Emails sent on: shipment status change, delay notify, and public contact form.

Set `APP_NAME` in Supabase secrets so email copy matches the client brand.

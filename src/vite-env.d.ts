/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_LEGAL_NAME?: string;
  readonly VITE_APP_TAGLINE?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_APP_LOGO_LETTER?: string;
  readonly VITE_ADMIN_TITLE?: string;
  readonly VITE_AUTH_INTERNAL_DOMAIN?: string;
  readonly VITE_THEME_STORAGE_KEY?: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

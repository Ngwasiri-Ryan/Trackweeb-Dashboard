import { ClientOnly } from "@/components/client-only";
import { APIProvider } from "@vis.gl/react-google-maps";
import type { ReactNode } from "react";

export const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

/** App-wide Google Maps provider — mount once in main.tsx */
export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  if (!googleMapsApiKey) return <>{children}</>;

  return (
    <ClientOnly fallback={children}>
      <APIProvider apiKey={googleMapsApiKey}>{children}</APIProvider>
    </ClientOnly>
  );
}

export function GoogleMapsShell({
  children,
  height = "420px",
  className = "",
}: {
  children: ReactNode;
  height?: string;
  className?: string;
}) {
  if (!googleMapsApiKey) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-border bg-muted/30 px-4 text-center text-sm text-muted-foreground ${className}`}
        style={{ height }}
      >
        Set <code className="mx-1 rounded bg-muted px-1">VITE_GOOGLE_MAPS_API_KEY</code> in{" "}
        <code className="rounded bg-muted px-1">.env</code> to enable Google Maps.
      </div>
    );
  }

  return (
    <ClientOnly
      fallback={
        <div
          className={`flex items-center justify-center rounded-xl border border-border bg-muted/20 text-sm text-muted-foreground ${className}`}
          style={{ height }}
        >
          Loading map…
        </div>
      }
    >
      <div
        className={`overflow-hidden rounded-xl border border-border ${className}`}
        style={{ height, width: "100%" }}
      >
        {children}
      </div>
    </ClientOnly>
  );
}

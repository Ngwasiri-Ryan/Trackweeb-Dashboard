import {
  Box,
  Clock,
  Compass,
  LocateFixed,
  MapPin,
  Timer,
  Truck,
  X,
} from "lucide-react";
import { brand } from "@/lib/brand";

export function LoginVisualPanel() {
  return (
    <div
      id="login-map-panel"
      className="login-visual-panel relative flex h-full min-h-[520px] w-full flex-col justify-between overflow-hidden rounded-[32px] p-4 sm:p-6 lg:min-h-full"
    >
      <img
        src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1400&q=80"
        alt="Fleet control dashboard"
        className="absolute inset-0 h-full w-full object-cover object-center opacity-85 transition-transform duration-1000 ease-out hover:scale-105"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src =
            `https://placehold.co/1200x800/1e293b/ffffff?text=${encodeURIComponent(brand.name)}+Fleet+Control`;
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/40" />

      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="max-w-[280px] space-y-1.5 sm:max-w-xs">
          <div className="login-map-dispatch shadow-floating flex items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-xs font-bold sm:text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-ping rounded-full bg-[var(--login-text)]" />
              <span>Asset 1478: Dispatch</span>
            </div>
            <span className="rounded-md bg-[color-mix(in_oklch,var(--login-text)_10%,transparent)] px-2 py-0.5 text-[11px] font-extrabold tracking-wide">
              ETA 10:15am
            </span>
          </div>
          <div className="login-map-chip--dark ml-2 w-fit rounded-full px-3 py-1 font-mono text-[11px] tracking-wider shadow-sm backdrop-blur-md">
            <Clock className="login-map-accent mr-1 inline h-3 w-3" />
            09:30am - 10:00am
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="login-map-chip flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur-md">
            <span className="login-map-accent font-bold">GPS</span>
            <div className="flex h-3 items-end gap-0.5">
              <span className="login-map-accent-bg h-1.5 w-1 rounded-sm" />
              <span className="login-map-accent-bg h-2.5 w-1 rounded-sm" />
              <span className="login-map-accent-bg h-3.5 w-1 rounded-sm" />
              <span className="h-2 w-1 rounded-sm bg-[color-mix(in_oklch,var(--white)_45%,transparent)]" />
            </div>
          </div>

          <div className="login-map-chip flex h-8 w-8 items-center justify-center rounded-full text-white backdrop-blur-md">
            <Compass
              className="login-map-accent h-3.5 w-3.5"
              style={{ animation: "spin 12s linear infinite" }}
            />
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--white)_90%,transparent)] text-sm font-bold shadow-md" style={{ color: "var(--login-text)" }}>
            <X className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div className="relative z-10 my-auto py-6">
        <div className="absolute top-0 right-2 z-20 hidden flex-col items-end gap-2 sm:flex">
          <div className="login-map-chip flex -space-x-2.5 overflow-hidden rounded-full p-1.5 shadow-lg backdrop-blur-md">
            {[
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
              "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80",
              "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80",
            ].map((src) => (
              <img
                key={src}
                className="inline-block h-8 w-8 rounded-full object-cover ring-2 ring-white"
                src={src}
                alt=""
              />
            ))}
          </div>
          <span className="login-map-chip--dark rounded-full px-2.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            3 Active Dispatchers
          </span>
        </div>

        <div className="glass-panel shadow-floating mx-auto mb-4 max-w-lg rounded-2xl p-3 sm:p-4" style={{ color: "var(--login-text)" }}>
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
              <span
                key={day}
                className={
                  i === 2
                    ? "font-bold"
                    : i === 3
                      ? "login-map-stat--moved font-bold"
                      : undefined
                }
              >
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm font-extrabold">
            {[22, 23, 24, 25, 26, 27, 28].map((d, i) => (
              <span
                key={d}
                className={`py-1 ${
                  i === 2
                    ? "login-map-dispatch rounded-lg shadow-sm"
                    : i === 3
                      ? "login-visual-panel rounded-lg text-white"
                      : ""
                }`}
              >
                {d}
              </span>
            ))}
          </div>
          <div className="relative mt-3 flex h-4 w-full items-center overflow-hidden rounded-lg bg-[color-mix(in_oklch,var(--login-text)_20%,transparent)]">
            <div className="login-map-accent-bg hatched-pattern relative h-full w-[65%]">
              <span className="absolute top-0 right-0 bottom-0 w-2 animate-pulse bg-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="glass-panel shadow-floating flex flex-col justify-between rounded-2xl p-3.5" style={{ color: "var(--login-text)" }}>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-extrabold tracking-tight">
                <Truck className="login-map-stat--moved h-3.5 w-3.5" />
                Real-time Fleet Activity
              </span>
              <span className="login-map-tag rounded-full px-2 py-0.5 text-[10px] font-bold">
                2Ah
              </span>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5 text-[10px] font-bold">
              <span className="login-map-tag flex items-center gap-1 rounded-md px-2 py-0.5">
                <span className="login-map-stat--moved h-1.5 w-1.5 rounded-full bg-current" />
                Delivery Trucks
              </span>
              <span className="login-map-tag--muted flex items-center gap-1 rounded-md px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--login-text)]" />
                Cargo Containers
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/50 p-2">
            <div className="flex items-center gap-1.5">
              <img
                className="h-6 w-6 rounded-full object-cover"
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80"
                alt=""
              />
              <span className="text-[11px] font-bold">Route #89</span>
            </div>
            <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--login-text-muted)" }}>
              <span className="login-map-stat--ok h-1.5 w-1.5 rounded-full bg-current" />
              <span className="relative h-0.5 w-6 bg-[color-mix(in_oklch,var(--login-text)_25%,transparent)]">
                <span className="login-map-accent-bg absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" />
              </span>
              <MapPin className="login-map-stat--delay h-3 w-3" />
            </div>
          </div>
        </div>

        <div className="glass-panel shadow-floating flex flex-col justify-between rounded-2xl p-3.5" style={{ color: "var(--login-text)" }}>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-extrabold tracking-tight">Asset Status Updates</span>
              <span className="text-[10px] font-semibold" style={{ color: "var(--login-text-muted)" }}>
                (Last 5 min)
              </span>
            </div>
            <div className="mb-3 grid grid-cols-3 gap-1 text-center">
              {[
                { value: "3", label: "moved", className: "login-map-stat--moved" },
                { value: "5", label: "on track", className: "login-map-stat--ok" },
                { value: "2", label: "delays", className: "login-map-stat--delay" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/40 bg-white/40 p-1.5"
                >
                  <div className={`text-sm font-extrabold ${stat.className}`}>{stat.value}</div>
                  <div className="text-[9px] leading-tight font-bold" style={{ color: "var(--login-text-muted)" }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-1 pt-1">
            <div className="flex -space-x-1">
              {[
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80",
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80",
              ].map((src) => (
                <img key={src} className="h-5 w-5 rounded-full ring-1 ring-white" src={src} alt="" />
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Truck className="login-map-stat--moved h-3.5 w-3.5" />
              <Box className="h-3.5 w-3.5" />
              <Timer className="login-map-stat--delay h-3.5 w-3.5 animate-bounce" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoginBrandPill() {
  return (
    <div className="login-brand-pill shadow-pill">
      <span className="flex items-center gap-1.5 text-base font-bold">
        <LocateFixed className="login-map-stat--moved h-4 w-4" />
        {brand.name}
      </span>
      <span className="login-map-stat--ok inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
    </div>
  );
}

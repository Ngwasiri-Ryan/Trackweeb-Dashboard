import type { ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";

export type MetricCardVariant =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "destructive"
  | "violet";

const VARIANT_CLASS: Record<MetricCardVariant, string> = {
  default: "metric-card--default",
  info: "metric-card--info",
  success: "metric-card--success",
  warning: "metric-card--warning",
  destructive: "metric-card--destructive",
  violet: "metric-card--violet",
};

function hashSeed(seed: string) {
  return seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function buildSinePath(seed: string, width: number, height: number) {
  const hash = hashSeed(seed);
  const amplitude = height * 0.32;
  const mid = height * 0.58;
  const freq = 2.2 + (hash % 4) * 0.35;
  const phase = (hash % 360) * (Math.PI / 180);
  const parts: string[] = [];

  for (let x = 0; x <= width; x += 3) {
    const t = x / width;
    const y =
      mid +
      Math.sin(t * Math.PI * freq + phase) * amplitude +
      Math.sin(t * Math.PI * (freq * 1.7) + phase * 0.5) * (amplitude * 0.25);
    parts.push(`${x === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return parts.join(" ");
}

function buildAreaPath(linePath: string, width: number, height: number) {
  return `${linePath} L${width},${height} L0,${height} Z`;
}

export function MetricSparkline({
  seed,
  className,
}: {
  seed: string;
  variant?: MetricCardVariant;
  className?: string;
}) {
  const width = 96;
  const height = 44;
  const linePath = buildSinePath(seed, width, height);
  const areaPath = buildAreaPath(linePath, width, height);
  const gradId = `spark-${hashSeed(seed)}`;

  return (
    <div className={cn("relative h-11 w-24 shrink-0", className)} aria-hidden>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--metric-stroke, var(--primary))" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--metric-stroke, var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke="var(--metric-stroke, var(--primary))"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="metric-sparkline-stroke"
        />
      </svg>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  variant = "default",
  sparkSeed,
  to,
  search,
  className,
  children,
  compact = false,
  labelClassName,
  hintClassName,
  iconClassName,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  variant?: MetricCardVariant | "delay";
  sparkSeed?: string;
  to?: string;
  search?: Record<string, unknown>;
  className?: string;
  children?: ReactNode;
  compact?: boolean;
  labelClassName?: string;
  hintClassName?: string;
  iconClassName?: string;
}) {
  const resolvedVariant: MetricCardVariant = variant === "delay" ? "destructive" : (variant ?? "default");
  const seed = sparkSeed ?? label;
  const accentLabel = resolvedVariant !== "default" && resolvedVariant !== "info";

  const cardClass = cn(
    "apple-card metric-card relative flex overflow-hidden rounded-2xl border border-border/50 bg-card text-card-foreground shadow-card transition-shadow duration-300 hover:shadow-card-hover",
    VARIANT_CLASS[resolvedVariant],
    compact ? "p-4" : "p-5 pb-4",
    to && "cursor-pointer hover:border-border",
    resolvedVariant === "destructive" && "border-destructive/20 bg-destructive/5",
    className,
  );

  const inner = (
    <div className="relative z-10 flex min-w-0 flex-1 items-stretch justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "text-[11px] font-medium tracking-[0.08em] uppercase",
              accentLabel ? "metric-label--accent" : "text-muted-foreground",
              labelClassName,
            )}
          >
            {label}
          </span>
          {icon ? (
            <div className={cn("metric-icon-wrap shrink-0", iconClassName)}>{icon}</div>
          ) : null}
        </div>
        <div
          className={cn(
            "font-semibold tabular-nums tracking-tight text-foreground",
            compact ? "text-lg" : "text-2xl",
          )}
        >
          {value}
        </div>
        {hint ? (
          <div
            className={cn(
              "text-[11px] font-medium",
              accentLabel ? "metric-hint--accent" : "text-muted-foreground",
              hintClassName,
            )}
          >
            {hint}
          </div>
        ) : null}
        {children}
      </div>
      <MetricSparkline seed={seed} className="self-end" />
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        search={search}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className={cardClass}>{inner}</div>
      </Link>
    );
  }

  return <div className={cardClass}>{inner}</div>;
}

/** @deprecated Use MetricCard */
export const DashboardKpiCard = MetricCard;

/** Compact metric card alias for detail strips */
export const KpiCard = MetricCard;

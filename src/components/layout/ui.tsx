import type { ReactNode } from "react";
import { getStatusStyle } from "@/lib/status-styles";
import { formatStatus } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DashboardKpiCard,
  KpiCard,
  MetricCard,
  type MetricCardVariant,
} from "@/components/admin/metric-card";

export { DashboardKpiCard, KpiCard, MetricCard, type MetricCardVariant };

export function SurfaceCard({
  className,
  children,
  padded = true,
}: {
  className?: string;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/50 bg-card text-card-foreground shadow-card",
        padded && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionLabel({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{children}</h2>
      {action}
    </div>
  );
}

/** @deprecated Use MetricCard */
export function StatTile({
  label,
  value,
  hint,
  icon,
  accent,
  to,
  search,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: boolean;
  to?: string;
  search?: Record<string, unknown>;
  className?: string;
}) {
  return (
    <MetricCard
      label={label}
      value={value}
      hint={hint}
      icon={icon}
      variant={accent ? "success" : "default"}
      to={to}
      search={search}
      className={className}
    />
  );
}

export function WorkspaceHeader({
  title,
  description,
  actions,
  meta,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "space-y-4 rounded-2xl border border-border/50 bg-card p-6 text-card-foreground shadow-card",
        className,
      )}
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1 space-y-2">
          {meta}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-2 lg:border-t-0 lg:pt-0">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function DashboardHero({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <SurfaceCard className={cn("space-y-4 p-6", className)} padded={false}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-2">
          {eyebrow ? (
            <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              {eyebrow}
            </span>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-2 lg:border-t-0 lg:pt-0">
            {actions}
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  );
}

/** @deprecated Use DashboardHero for the light admin layout */
export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  imageSrc?: string;
  imageAlt?: string;
  className?: string;
}) {
  return (
    <DashboardHero
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={actions}
      className={className}
    />
  );
}

export function DetailSpecTile({
  label,
  value,
  className,
  mono = true,
}: {
  label: string;
  value: ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={cn("space-y-1 rounded-2xl border border-border/50 bg-card p-4 shadow-card", className)}>
      <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{label}</span>
      <div className={cn("text-xs font-bold text-foreground", mono && "font-mono")}>{value}</div>
    </div>
  );
}

export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; icon?: ReactNode }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border pt-2">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-xs whitespace-nowrap transition",
              isActive
                ? "border-primary font-bold text-primary"
                : "border-transparent font-semibold text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function StatusBadge({
  status,
  label,
  ping,
}: {
  status: string;
  label?: string;
  ping?: boolean;
}) {
  const style = getStatusStyle(status);
  const Icon = style.icon;
  const showPing = ping ?? style.ping;
  const text = label ?? formatStatus(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-semibold",
        style.badgeClass,
      )}
    >
      {showPing ? (
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              style.dotClass,
            )}
          />
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", style.dotClass)} />
        </span>
      ) : (
        <Icon className="h-3.5 w-3.5 shrink-0" />
      )}
      {text}
    </span>
  );
}

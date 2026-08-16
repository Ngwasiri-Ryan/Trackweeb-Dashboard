import type { TimelineEvent } from "@/lib/types";
import { SurfaceCard } from "@/components/layout/AppShell";
import { getStatusStyle } from "@/lib/status-styles";
import { formatDateTime, formatStatus } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ActivityTimeline({
  events,
  loading,
  title = "Audit trail & event log",
}: {
  events: TimelineEvent[];
  loading?: boolean;
  title?: string;
}) {
  if (loading) {
    return (
      <SurfaceCard padded>
        <p className="py-8 text-center text-sm text-muted-foreground">Loading timeline…</p>
      </SurfaceCard>
    );
  }

  if (events.length === 0) {
    return (
      <SurfaceCard padded>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <p className="mt-4 py-6 text-center text-sm text-muted-foreground">
          No timeline events recorded yet.
        </p>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard padded>
      <h3 className="text-sm font-bold text-foreground">{title}</h3>

      <div className="timeline-rail relative mt-6 space-y-6 pl-6 before:absolute before:top-2 before:bottom-2 before:left-2 before:w-0.5">
        {events.map((event, index) => {
          const style = getStatusStyle(event.status_code);
          const isActive = index === 0;

          return (
            <div key={event.id} className="relative">
              <div
                className={cn(
                  "absolute -left-6 top-0 h-4 w-4 rounded-full ring-4",
                  isActive ? cn(style.dotClass, style.ringClass) : "timeline-dot--idle ring-transparent",
                )}
              />
              <div className="text-xs font-bold text-foreground">
                {formatStatus(event.status_code)}
                {event.is_delay_event ? " — Exception" : ""}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">
                {formatDateTime(event.event_time)}
                {event.location_text ? ` · ${event.location_text}` : ""}
              </div>
              {event.description ? (
                <p className="mt-1 text-xs text-muted-foreground">{event.description}</p>
              ) : null}
              {event.delay_reason ? (
                <p className="mt-1 text-xs font-medium text-destructive">{event.delay_reason}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}

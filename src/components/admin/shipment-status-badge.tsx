import { getStatusStyle } from "@/lib/status-styles";
import { formatStatus } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ShipmentStatusBadge({
  status,
  className,
  ping,
  showIcon = true,
}: {
  status: string;
  className?: string;
  ping?: boolean;
  showIcon?: boolean;
}) {
  const style = getStatusStyle(status);
  const Icon = style.icon;
  const shouldPing = ping ?? style.ping;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-[11px] font-semibold",
        style.badgeClass,
        className,
      )}
    >
      {shouldPing ? (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              style.dotClass,
            )}
          />
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", style.dotClass)} />
        </span>
      ) : showIcon ? (
        <Icon className="h-3 w-3 shrink-0" />
      ) : null}
      {formatStatus(status)}
    </span>
  );
}

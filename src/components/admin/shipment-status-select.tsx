import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Status } from "@/lib/types";
import { getStatusStyle } from "@/lib/status-styles";
import { formatStatus } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ShipmentStatusSelect({
  value,
  statuses,
  disabled,
  onChange,
  className,
}: {
  value: string;
  statuses: Status[];
  disabled?: boolean;
  onChange: (newStatus: string) => void;
  className?: string;
}) {
  const style = getStatusStyle(value);
  const Icon = style.icon;

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== value) onChange(next);
      }}
    >
      <SelectTrigger
        className={cn(
          "h-7 w-auto min-w-[128px] max-w-[168px] gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold shadow-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30",
          style.badgeClass,
          className,
        )}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {style.ping ? (
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                style.dotClass,
              )}
            />
            <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", style.dotClass)} />
          </span>
        ) : (
          <Icon className="h-3 w-3 shrink-0" />
        )}
        <SelectValue>{formatStatus(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {statuses.map((st) => (
          <SelectItem key={st.code} value={st.code}>
            {st.display_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

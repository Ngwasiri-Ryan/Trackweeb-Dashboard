import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function SortableTableHead({
  label,
  field,
  currentSort,
  onSort,
  className,
}: {
  label: string;
  field: string;
  currentSort: string;
  onSort: (sort: string) => void;
  className?: string;
}) {
  const desc = `-${field}`;
  const asc = field;
  const active = currentSort === desc || currentSort === asc;
  const isDesc = currentSort === desc;

  return (
    <TableHead className={className}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
        onClick={() => onSort(active && isDesc ? asc : desc)}
      >
        {label}
        {!active && <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />}
        {active && isDesc && <ArrowDown className="h-3.5 w-3.5" />}
        {active && !isDesc && <ArrowUp className="h-3.5 w-3.5" />}
      </button>
    </TableHead>
  );
}

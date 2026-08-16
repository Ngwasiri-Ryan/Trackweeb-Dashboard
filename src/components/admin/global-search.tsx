import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { globalSearch } from "@/lib/api/dashboard";
import { ShipmentStatusBadge } from "@/components/admin/shipment-status-badge";

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const searchQ = useQuery({
    queryKey: ["search", q],
    queryFn: () => globalSearch(q),
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  });

  const results = searchQ.data?.data ?? [];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("global-search-input")?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Popover open={open && q.length >= 2} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            id="global-search-input"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search shipments, waybills, clients (Press '⌘K')..."
            className="search-input"
          />
          <span className="search-kbd absolute top-1/2 right-3 hidden -translate-y-1/2 sm:inline">
            ⌘K
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-[min(24rem,calc(100vw-2rem))] rounded-xl p-0">
        {searchQ.isLoading && (
          <p className="px-4 py-3 text-sm text-muted-foreground">Searching…</p>
        )}
        {!searchQ.isLoading && results.length === 0 && q.length >= 2 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">No results</p>
        )}
        {results.length > 0 && (
          <ul className="max-h-72 overflow-y-auto py-1">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    setOpen(false);
                    setQ("");
                    navigate({ to: "/shipments/$id", params: { id: r.id } });
                  }}
                >
                  <span className="tracking-code-sm">{r.tracking_code}</span>
                  <span className="text-xs text-muted-foreground">{r.label}</span>
                  <ShipmentStatusBadge status={r.status} className="text-[10px]" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { RefreshCw, X } from "lucide-react";
import {
  AppShell,
  SectionLabel,
  SurfaceCard,
  WorkspaceHeader,
} from "@/components/layout/AppShell";
import { AdminLiveMap } from "@/components/admin/live-map-lazy";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { fetchLiveMap } from "@/lib/api/dashboard";
import { fetchModes } from "@/lib/api/admin";
import { ShipmentStatusBadge } from "@/components/admin/shipment-status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function LiveMapPage() {
  const [status, setStatus] = useState<string>("all");
  const [modeId, setModeId] = useState<string>("all");
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const modesQ = useQuery({ queryKey: ["modes"], queryFn: fetchModes });

  const liveQ = useQuery({
    queryKey: ["live-map", status, modeId, delayedOnly],
    queryFn: () =>
      fetchLiveMap({
        status: status === "all" ? undefined : status,
        mode_id: modeId === "all" ? undefined : modeId,
        is_delayed: delayedOnly || undefined,
      }),
    refetchInterval: 30_000,
  });

  const items = liveQ.data?.data ?? [];
  const hasFilters = status !== "all" || modeId !== "all" || delayedOnly;

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId(undefined);
      return;
    }
    if (!selectedId || !items.some((s) => s.id === selectedId)) {
      setSelectedId(items[0]!.id);
    }
  }, [items, selectedId]);

  const selected = items.find((s) => s.id === selectedId);

  return (
    <AppShell>
      <WorkspaceHeader
        title="Live tracking map"
        description="Active shipments with live animated positions along real routes. Orange dots move in real time."
        meta={
          liveQ.data && (
            <span className="mb-2 inline-block text-[11px] text-muted-foreground">
              Last updated {new Date(liveQ.data.updated_at).toLocaleTimeString()} · {liveQ.data.count} shipments
            </span>
          )
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={liveQ.isFetching}
            onClick={() => void liveQ.refetch()}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${liveQ.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px] rounded-full">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="in_transit">In transit</SelectItem>
            <SelectItem value="departed">Departed</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
            <SelectItem value="arrived">Arrived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={modeId} onValueChange={setModeId}>
          <SelectTrigger className="w-[160px] rounded-full">
            <SelectValue placeholder="Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modes</SelectItem>
            {(modesQ.data?.data ?? []).map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => setDelayedOnly((v) => !v)}
          className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
            delayedOnly
              ? "border-destructive bg-destructive/10 text-destructive"
              : "border-border bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          Delayed only
        </button>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-xs"
            onClick={() => {
              setStatus("all");
              setModeId("all");
              setDelayedOnly(false);
            }}
          >
            <X className="mr-1 h-3 w-3" />
            Clear filters
          </Button>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <AdminLiveMap
            items={items}
            selectedId={selectedId}
            onSelect={setSelectedId}
            height="min(70vh, 560px)"
          />
          {selected && (
            <p className="mt-2 text-xs text-muted-foreground">
              Selected: <span className="tracking-code font-semibold">{selected.tracking_code}</span>
              {" · "}
              {Math.round(selected.progress_percent)}% complete
            </p>
          )}
        </div>
        <div className="xl:col-span-2">
          <SectionLabel>Shipments on map</SectionLabel>
          <SurfaceCard padded={false} className="max-h-[min(70vh,560px)] overflow-y-auto">
            {liveQ.isLoading && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
            )}
            {!liveQ.isLoading && items.length === 0 && (
              <EmptyState
                title="No shipments match filters"
                description="Try clearing filters or check back when shipments are in transit."
                action={
                  hasFilters ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => {
                        setStatus("all");
                        setModeId("all");
                        setDelayedOnly(false);
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            )}
            <ul className="divide-y divide-border">
              {items.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    onMouseEnter={() => setSelectedId(s.id)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-muted/50 ${
                      selectedId === s.id ? "border-l-2 border-accent bg-accent/5" : "border-l-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="tracking-code-sm">
                        {s.tracking_code}
                      </span>
                      <ShipmentStatusBadge status={s.status} className="text-[10px]" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {s.receiver_name} · {Math.round(s.progress_percent)}%
                    </span>
                    <Link
                      to="/shipments/$id"
                      params={{ id: s.id }}
                      className="text-[11px] font-semibold text-accent hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open shipment →
                    </Link>
                  </button>
                </li>
              ))}
            </ul>
          </SurfaceCard>
        </div>
      </div>
    </AppShell>
  );
}

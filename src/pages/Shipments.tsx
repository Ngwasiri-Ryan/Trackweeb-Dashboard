import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Box,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AppShell,
  DashboardKpiCard,
  SurfaceCard,
  WorkspaceHeader,
} from "@/components/layout/AppShell";
import { DeleteShipmentDialog } from "@/components/admin/delete-shipment-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { ModeIcon } from "@/components/admin/mode-icon";
import { ShipmentStatusSelect } from "@/components/admin/shipment-status-select";
import { StatusChangeDialog } from "@/components/admin/status-change-dialog";
import { SortableTableHead } from "@/components/admin/sortable-table-head";
import { TablePagination, TableRowNumber } from "@/components/admin/table-pagination";
import { TableSkeletonRows } from "@/components/admin/table-skeleton";
import { rowNumber } from "@/hooks/use-client-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchModes, fetchStatuses } from "@/lib/api/admin";
import { fetchDashboardSummary } from "@/lib/api/dashboard";
import { archiveShipment, fetchShipments, updateShipmentStatus } from "@/lib/api/shipments";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";


type ShipmentsSearch = {
  q?: string;
  status?: string;
  mode?: string;
  delayed?: string;
  page?: number;
  sort?: string;
};

function useShipmentsSearch(): ShipmentsSearch {
  const [params] = useSearchParams();
  const page = Number(params.get("page"));
  return {
    q: params.get("q") ?? "",
    status: params.get("status") ?? "all",
    mode: params.get("mode") ?? "all",
    delayed: params.get("delayed") === "1" ? "1" : undefined,
    page: page > 0 ? page : 1,
    sort: params.get("sort") ?? "-depart_time",
  };
}

const PAGE_SIZE = 15;

export default function ShipmentsPage() {
  const qc = useQueryClient();
  const search = useShipmentsSearch();
  const navigate = useNavigate();
  const routerNavigate = useNavigate();
  const [searchInput, setSearchInput] = useState(search.q ?? "");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; code: string } | null>(null);
  const [statusChange, setStatusChange] = useState<{
    id: string;
    code: string;
    from: string;
    to: string;
    receiverName: string;
    receiverEmail: string | null;
  } | null>(null);

  const debouncedQ = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    setSearchInput(search.q ?? "");
  }, [search.q]);

  useEffect(() => {
    const urlQ = search.q ?? "";
    if (debouncedQ === urlQ) return;
    navigate({
      search: (prev) => ({
        ...prev,
        q: debouncedQ || undefined,
        page: 1,
      }),
    });
  }, [debouncedQ, navigate, search.q]);

  const updateSearch = (patch: Partial<ShipmentsSearch>) => {
    navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
        page: patch.page ?? 1,
      }),
    });
  };

  const listQ = useQuery({
    queryKey: ["shipments", debouncedQ, search.status, search.mode, search.delayed, search.page, search.sort],
    queryFn: () =>
      fetchShipments({
        search: debouncedQ || undefined,
        status: search.status === "all" ? undefined : search.status,
        mode_id: search.mode === "all" ? undefined : search.mode,
        is_delayed: search.delayed === "1" ? true : undefined,
        page: search.page ?? 1,
        limit: PAGE_SIZE,
        sort: search.sort ?? "-depart_time",
      }),
  });

  const summaryQ = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => fetchDashboardSummary(),
  });

  const statusesQ = useQuery({ queryKey: ["statuses"], queryFn: fetchStatuses });
  const modesQ = useQuery({ queryKey: ["modes"], queryFn: fetchModes });

  const deleteM = useMutation({
    mutationFn: (id: string) => archiveShipment(id),
    onSuccess: () => {
      toast.success("Shipment deleted");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["shipments"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "summary"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Delete failed"),
  });

  const statusM = useMutation({
    mutationFn: ({
      id,
      status,
      description,
    }: {
      id: string;
      status: string;
      description?: string;
    }) => updateShipmentStatus(id, { status, description }),
    onSuccess: (res) => {
      setStatusChange(null);
      if (res.notification?.sent) {
        toast.success(`Status updated — email sent to ${res.notification.sent_to}`);
      } else if (res.notification?.error) {
        toast.warning(`Status updated, but email failed: ${res.notification.error}`);
      } else if (!res.shipment.receiver_email) {
        toast.success("Status updated (no client email on file)");
      } else {
        toast.success("Status updated");
      }
      qc.invalidateQueries({ queryKey: ["shipments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Status update failed"),
  });

  const statuses = statusesQ.data?.data ?? [];

  const meta = listQ.data?.meta;
  const summary = summaryQ.data;
  const rows = listQ.data?.data ?? [];
  const hasFilters =
    !!debouncedQ ||
    (search.status && search.status !== "all") ||
    (search.mode && search.mode !== "all") ||
    search.delayed === "1";

  function openStatusChange(shipment: (typeof rows)[number], to: string) {
    setStatusChange({
      id: shipment.id,
      code: shipment.tracking_code,
      from: shipment.status,
      to,
      receiverName: shipment.receiver_name,
      receiverEmail: shipment.receiver_email ?? null,
    });
  }

  return (
    <AppShell>
      <WorkspaceHeader
        title="Shipments"
        description="Create, track, and manage all shipments across road, air, sea, and rail."
        actions={
          <Button className="btn-accent rounded-full" asChild>
            <Link to="/shipments/new">
              <Plus className="mr-1.5 h-4 w-4" />
              New shipment
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <DashboardKpiCard
          label="Total active"
          value={summary?.total_active ?? "—"}
          hint="Registered in fleet database"
          variant="info"
          icon={<Package className="h-4 w-4" />}
          to="/shipments"
        />
        <DashboardKpiCard
          label="In transit"
          value={summary?.in_transit ?? "—"}
          hint="Currently en route to hubs"
          variant="warning"
          icon={<Truck className="h-4 w-4" />}
          to="/shipments"
          search={{ status: "in_transit" }}
        />
        <DashboardKpiCard
          label="Active delays"
          value={summary?.active_delays ?? "—"}
          hint="Needs attention or override"
          variant="delay"
          icon={<AlertTriangle className="h-4 w-4" />}
          to="/shipments"
          search={{ delayed: "1" }}
        />
        <DashboardKpiCard
          label="Delivered today"
          value={summary?.delivered_today ?? "—"}
          hint="Successful handoffs today"
          variant="success"
          icon={<Box className="h-4 w-4" />}
          to="/shipments"
          search={{ status: "delivered" }}
        />
      </div>

      <SurfaceCard className="mb-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search tracking code, receiver, destination…"
                className="pl-9"
              />
            </div>
            <Select
              value={search.status ?? "all"}
              onValueChange={(v) => updateSearch({ status: v, page: 1 })}
            >
              <SelectTrigger className="w-full rounded-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(statusesQ.data?.data ?? []).map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={search.mode ?? "all"}
              onValueChange={(v) => updateSearch({ mode: v, page: 1 })}
            >
              <SelectTrigger className="w-full rounded-full sm:w-[160px]">
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
              onClick={() =>
                updateSearch({
                  delayed: search.delayed === "1" ? undefined : "1",
                  page: 1,
                })
              }
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                search.delayed === "1"
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              Delayed only
            </button>
          </div>
          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Active filters</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 rounded-full text-xs"
                onClick={() => {
                  setSearchInput("");
                  navigate({ search: {} });
                }}
              >
                <X className="mr-1 h-3 w-3" />
                Clear all
              </Button>
            </div>
          )}
        </div>
      </SurfaceCard>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {listQ.isLoading && (
          <SurfaceCard>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/40" />
              ))}
            </div>
          </SurfaceCard>
        )}
        {!listQ.isLoading && rows.length === 0 && (
          <SurfaceCard padded={false}>
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title="No shipments found"
              description={hasFilters ? "Try adjusting your filters." : "Create your first shipment to get started."}
              action={
                hasFilters ? (
                  <Button variant="outline" className="rounded-full" onClick={() => { setSearchInput(""); navigate({ search: {} }); }}>
                    Clear filters
                  </Button>
                ) : (
                  <Button className="btn-accent rounded-full" asChild>
                    <Link to="/shipments/new">New shipment</Link>
                  </Button>
                )
              }
            />
          </SurfaceCard>
        )}
        {rows.map((s) => (
          <SurfaceCard key={s.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <Link to="/shipments/$id" params={{ id: s.id }} className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <ModeIcon code={s.mode.code} />
                  <span className="tracking-code-sm">
                    {s.tracking_code}
                  </span>
                </div>
                <div className="mt-1 text-sm">{s.receiver_name}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{s.destination}</div>
              </Link>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" asChild>
                  <Link to="/shipments/$id/edit" params={{ id: s.id }}>
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-destructive"
                  onClick={() => setDeleteTarget({ id: s.id, code: s.tracking_code })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <ShipmentStatusSelect
                value={s.status}
                statuses={statuses}
                disabled={statusM.isPending}
                onChange={(to) => openStatusChange(s, to)}
              />
              {s.is_delayed && (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                  Delayed
                </span>
              )}
              <span className="text-xs text-muted-foreground">ETA {formatDateTime(s.final_eta)}</span>
            </div>
          </SurfaceCard>
        ))}
        {meta && meta.total_pages > 1 && (
          <TablePagination
            page={meta.page}
            totalPages={meta.total_pages}
            total={meta.total}
            pageSize={meta.limit}
            onPageChange={(p) => updateSearch({ page: p })}
          />
        )}
      </div>

      {/* Desktop table */}
      <SurfaceCard padded={false} className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
              <TableRow className="border-border">
                <TableHead className="w-12 text-[11px] font-black tracking-wider text-muted-foreground uppercase">
                  #
                </TableHead>
                <TableHead className="text-[11px] font-black tracking-wider text-muted-foreground uppercase">
                  Tracking ID
                </TableHead>
                <TableHead className="section-heading hidden text-[11px] md:table-cell">
                  Receiver
                </TableHead>
                <TableHead className="section-heading hidden text-[11px] lg:table-cell">
                  Destination
                </TableHead>
                <TableHead className="text-[11px] font-black tracking-wider text-muted-foreground uppercase">
                  Status
                </TableHead>
                <SortableTableHead
                  label="Depart"
                  field="depart_time"
                  currentSort={search.sort ?? "-depart_time"}
                  onSort={(sort) => updateSearch({ sort, page: 1 })}
                  className="hidden sm:table-cell"
                />
                <SortableTableHead
                  label="ETA"
                  field="final_eta"
                  currentSort={search.sort ?? "-depart_time"}
                  onSort={(sort) => updateSearch({ sort, page: 1 })}
                  className="hidden sm:table-cell"
                />
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQ.isLoading && <TableSkeletonRows cols={8} rows={6} />}
              {!listQ.isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState
                      icon={<Package className="h-5 w-5" />}
                      title="No shipments found"
                      description={hasFilters ? "Try adjusting your filters." : "Create your first shipment to get started."}
                      action={
                        hasFilters ? (
                          <Button variant="outline" className="rounded-full" onClick={() => { setSearchInput(""); navigate({ search: {} }); }}>
                            Clear filters
                          </Button>
                        ) : (
                          <Button className="btn-accent rounded-full" asChild>
                            <Link to="/shipments/new">New shipment</Link>
                          </Button>
                        )
                      }
                    />
                  </TableCell>
                </TableRow>
              )}
              {rows.map((s, i) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer border-border/40 hover:bg-muted/50"
                  onClick={() => routerNavigate({ to: "/shipments/$id", params: { id: s.id } })}
                >
                  <TableCell>
                    <TableRowNumber n={rowNumber(search.page ?? 1, PAGE_SIZE, i)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ModeIcon code={s.mode.code} />
                      <span className="tracking-code-sm">
                        {s.tracking_code}
                      </span>
                      {s.is_delayed && (
                        <span className="delay-badge px-1.5 py-0.5 text-[9px] uppercase">
                          Delayed
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden font-bold text-foreground md:table-cell">
                    {s.receiver_name}
                  </TableCell>
                  <TableCell className="hidden max-w-[200px] truncate font-medium text-muted-foreground lg:table-cell">
                    {s.destination}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <ShipmentStatusSelect
                      value={s.status}
                      statuses={statuses}
                      disabled={statusM.isPending}
                      onChange={(to) => openStatusChange(s, to)}
                    />
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {formatDateTime(s.depart_time)}
                  </TableCell>
                  <TableCell className="hidden font-mono text-[11px] font-bold text-foreground sm:table-cell">
                    {formatDateTime(s.final_eta)}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary"
                        aria-label="Edit shipment"
                        asChild
                      >
                        <Link to="/shipments/$id/edit" params={{ id: s.id }}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                        aria-label="Delete shipment"
                        onClick={() => setDeleteTarget({ id: s.id, code: s.tracking_code })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {meta && (
          <TablePagination
            page={meta.page}
            totalPages={meta.total_pages}
            total={meta.total}
            pageSize={meta.limit}
            onPageChange={(p) => updateSearch({ page: p })}
          />
        )}
      </SurfaceCard>

      <StatusChangeDialog
        open={!!statusChange}
        onOpenChange={(open) => !open && setStatusChange(null)}
        trackingCode={statusChange?.code ?? ""}
        currentStatus={statusChange?.from ?? ""}
        newStatus={statusChange?.to ?? ""}
        receiverEmail={statusChange?.receiverEmail ?? null}
        receiverName={statusChange?.receiverName ?? ""}
        pending={statusM.isPending}
        onConfirm={(description) =>
          statusChange &&
          statusM.mutate({
            id: statusChange.id,
            status: statusChange.to,
            description,
          })
        }
      />

      <DeleteShipmentDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        trackingCode={deleteTarget?.code ?? ""}
        pending={deleteM.isPending}
        onConfirm={() => deleteTarget && deleteM.mutate(deleteTarget.id)}
      />
    </AppShell>
  );
}

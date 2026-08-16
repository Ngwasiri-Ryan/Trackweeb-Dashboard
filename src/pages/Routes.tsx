import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MapPin, Plus, Route as RouteIcon, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  AppShell,
  MetricCard,
  SurfaceCard,
  WorkspaceHeader,
} from "@/components/layout/AppShell";
import { TablePagination, TableRowNumber } from "@/components/admin/table-pagination";
import { rowNumber, useClientPagination } from "@/hooks/use-client-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  createRoute,
  deactivateRoute,
  fetchModes,
  fetchRoutes,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";

const PAGE_SIZE = 10;

export default function RoutesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [modeId, setModeId] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");

  const routesQ = useQuery({ queryKey: ["routes"], queryFn: () => fetchRoutes() });
  const modesQ = useQuery({ queryKey: ["modes"], queryFn: fetchModes });

  const allRoutes = routesQ.data?.data ?? [];

  const kpis = useMemo(() => {
    const active = allRoutes.filter((r) => r.is_active).length;
    const inactive = allRoutes.length - active;
    const totalKm = allRoutes.reduce((sum, r) => sum + r.distance_km, 0);
    const modes = new Set(allRoutes.map((r) => r.mode.code)).size;
    return { total: allRoutes.length, active, inactive, totalKm, modes };
  }, [allRoutes]);

  const { page, setPage, total, totalPages, slice } = useClientPagination(allRoutes, PAGE_SIZE);

  const createM = useMutation({
    mutationFn: () =>
      createRoute({
        mode_id: modeId,
        origin,
        destination,
        distance_km: Number(distance),
        default_duration_hours: Number(duration),
      }),
    onSuccess: () => {
      toast.success("Route created");
      setOpen(false);
      setOrigin("");
      setDestination("");
      setDistance("");
      setDuration("");
      qc.invalidateQueries({ queryKey: ["routes"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed"),
  });

  const deleteM = useMutation({
    mutationFn: deactivateRoute,
    onSuccess: () => {
      toast.success("Route deactivated");
      qc.invalidateQueries({ queryKey: ["routes"] });
    },
  });

  return (
    <AppShell>
      <WorkspaceHeader
        title="Routes"
        description="Predefined origin–destination pairs for faster shipment creation."
        actions={
          <Button className="btn-accent rounded-full" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add route
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total routes"
          value={kpis.total}
          icon={<RouteIcon className="h-4 w-4" />}
          variant="info"
        />
        <MetricCard
          label="Active"
          value={kpis.active}
          icon={<Zap className="h-4 w-4" />}
          variant="success"
        />
        <MetricCard
          label="Inactive"
          value={kpis.inactive}
          hint="Deactivated routes"
          variant="warning"
        />
        <MetricCard
          label="Network distance"
          value={`${Math.round(kpis.totalKm).toLocaleString()} km`}
          icon={<MapPin className="h-4 w-4" />}
          hint={`${kpis.modes} transport mode${kpis.modes === 1 ? "" : "s"}`}
          variant="violet"
        />
      </div>

      <SurfaceCard padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Origin</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {routesQ.isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Loading routes…
                  </TableCell>
                </TableRow>
              )}
              {!routesQ.isLoading && total === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No routes yet — add your first route above.
                  </TableCell>
                </TableRow>
              )}
              {slice.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <TableRowNumber n={rowNumber(page, PAGE_SIZE, i)} />
                  </TableCell>
                  <TableCell className="font-medium">{r.mode.display_name}</TableCell>
                  <TableCell>{r.origin}</TableCell>
                  <TableCell>{r.destination}</TableCell>
                  <TableCell>{r.distance_km} km</TableCell>
                  <TableCell>{r.default_duration_hours}h</TableCell>
                  <TableCell>
                    <span className={r.is_active ? "text-success" : "text-muted-foreground"}>
                      {r.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {r.is_active && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteM.mutate(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <TablePagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </SurfaceCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">New route</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createM.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={modeId} onValueChange={setModeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {(modesQ.data?.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Origin</Label>
                <Input value={origin} onChange={(e) => setOrigin(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Destination</Label>
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Distance (km)</Label>
                <Input type="number" value={distance} onChange={(e) => setDistance(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Default duration (hours)</Label>
                <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} required />
              </div>
            </div>
            <Button type="submit" className="btn-accent w-full rounded-full" disabled={createM.isPending}>
              Create route
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

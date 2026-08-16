import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Copy, KeyRound, Plus, ShieldCheck, ShieldOff } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createApiKey, fetchApiKeys, revokeApiKey } from "@/lib/api/admin";
import { formatDateTime, formatRelative } from "@/lib/format";

const PAGE_SIZE = 10;

export default function ApiKeysPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [plaintext, setPlaintext] = useState<string | null>(null);

  const keysQ = useQuery({ queryKey: ["api-keys"], queryFn: fetchApiKeys });
  const allKeys = keysQ.data?.data ?? [];

  const kpis = useMemo(() => {
    const active = allKeys.filter((k) => k.is_active).length;
    return { total: allKeys.length, active, revoked: allKeys.length - active };
  }, [allKeys]);

  const { page, setPage, total, totalPages, slice } = useClientPagination(allKeys, PAGE_SIZE);

  const createM = useMutation({
    mutationFn: () => createApiKey({ name }),
    onSuccess: (res) => {
      setPlaintext(res.plaintext_key);
      setName("");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key created — copy it now");
    },
  });

  const revokeM = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      toast.success("Key revoked");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  return (
    <AppShell>
      <WorkspaceHeader
        title="API keys"
        description="Manage programmatic access for integrations and the public tracking site."
        actions={
          <Button className="btn-accent rounded-full" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create key
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Total keys" value={kpis.total} icon={<KeyRound className="h-4 w-4" />} variant="info" />
        <MetricCard
          label="Active"
          value={kpis.active}
          icon={<ShieldCheck className="h-4 w-4" />}
          variant="success"
        />
        <MetricCard
          label="Revoked"
          value={kpis.revoked}
          icon={<ShieldOff className="h-4 w-4" />}
          variant="default"
        />
      </div>

      <SurfaceCard padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keysQ.isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Loading API keys…
                  </TableCell>
                </TableRow>
              )}
              {!keysQ.isLoading && total === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No API keys yet
                  </TableCell>
                </TableRow>
              )}
              {slice.map((k, i) => (
                <TableRow key={k.id}>
                  <TableCell>
                    <TableRowNumber n={rowNumber(page, PAGE_SIZE, i)} />
                  </TableCell>
                  <TableCell className="font-medium">{k.name}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                    {k.permissions.join(", ")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {k.last_used_at ? formatRelative(k.last_used_at) : "Never"}
                  </TableCell>
                  <TableCell className="text-xs">{formatDateTime(k.created_at)}</TableCell>
                  <TableCell>{k.is_active ? "Active" : "Revoked"}</TableCell>
                  <TableCell>
                    {k.is_active && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => revokeM.mutate(k.id)}
                      >
                        Revoke
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
            <DialogTitle className="font-display">Create API key</DialogTitle>
          </DialogHeader>
          {!plaintext ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                createM.mutate();
              }}
            >
              <div className="space-y-2">
                <Label>Key name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Production website"
                  required
                />
              </div>
              <Button type="submit" className="btn-accent w-full rounded-full" disabled={createM.isPending}>
                Generate key
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Copy this key now — it won't be shown again.
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs break-all">
                <KeyRound className="h-4 w-4 shrink-0 text-accent" />
                {plaintext}
                <Button
                  size="icon"
                  variant="ghost"
                  className="ml-auto shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(plaintext);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button
                className="w-full rounded-full"
                onClick={() => {
                  setPlaintext(null);
                  setOpen(false);
                }}
              >
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useSearchParams } from "react-router-dom";
import { Barcode, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell, SurfaceCard, WorkspaceHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchShipmentByCode } from "@/lib/api/shipments";
import { ApiError } from "@/lib/api/client";

export default function ScanShipmentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get("code") ?? "";
  const inputRef = useRef<HTMLInputElement>(null);
  const autoLookupDone = useRef(false);
  const [value, setValue] = useState(initialCode);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!initialCode.trim() || autoLookupDone.current) return;
    autoLookupDone.current = true;
    void lookup(initialCode);
  }, [initialCode]);

  const lookup = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;

    setPending(true);
    try {
      const shipment = await fetchShipmentByCode(code);
      if (!shipment) {
        toast.error("Shipment not found");
        inputRef.current?.select();
        return;
      }
      toast.success(`Found ${shipment.tracking_code}`);
      navigate({ to: "/shipments/$id", params: { id: shipment.id } });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Shipment not found");
      inputRef.current?.select();
    } finally {
      setPending(false);
    }
  };

  return (
    <AppShell>
      <WorkspaceHeader
        title="Scan shipment"
        description="Scan a barcode or enter a tracking code to open shipment details."
      />

      <div className="mx-auto max-w-xl">
        <SurfaceCard className="p-6">
          <div className="mb-6 flex items-center justify-center">
            <div className="rounded-full bg-primary/10 p-4 text-primary">
              <Barcode className="h-8 w-8" />
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void lookup(value);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="scan-code">Tracking code</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  id="scan-code"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="Scan barcode or type TRK-2026-R-004821"
                  className="pl-9 font-mono"
                  autoComplete="off"
                  disabled={pending}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                USB barcode scanners type the tracking code automatically. Press Enter after scanning.
              </p>
            </div>

            <Button type="submit" className="w-full rounded-full" disabled={pending || !value.trim()}>
              {pending ? "Looking up…" : "Open shipment"}
            </Button>
          </form>
        </SurfaceCard>
      </div>
    </AppShell>
  );
}

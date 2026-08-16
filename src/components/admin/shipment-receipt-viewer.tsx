import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ExternalLink, FileText, Loader2, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/layout/AppShell";
import { ApiError } from "@/lib/api/client";
import {
  downloadShipmentReceipt,
  fetchShipmentReceiptHtml,
} from "@/lib/api/shipments";

type ShipmentReceiptViewerProps = {
  shipmentId: string;
  trackingCode: string;
};

function waitForReceiptReady(printWindow: Window): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    const timeoutMs = 12_000;

    const check = () => {
      try {
        const doc = printWindow.document;
        const barcodeReady = Boolean(doc.querySelector("#barcode")?.children.length);
        const qrReady = Boolean(doc.querySelector("#qrcode img, #qrcode canvas"));
        const flaggedReady = (printWindow as Window & { __receiptReady?: boolean }).__receiptReady;

        if ((barcodeReady && qrReady) || flaggedReady) {
          resolve();
          return;
        }
      } catch {
        /* cross-window access may fail briefly */
      }

      if (Date.now() - started >= timeoutMs) {
        resolve();
        return;
      }

      window.setTimeout(check, 120);
    };

    printWindow.addEventListener("load", () => window.setTimeout(check, 100), { once: true });
    check();
  });
}

export function ShipmentReceiptViewer({
  shipmentId,
  trackingCode,
}: ShipmentReceiptViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReceipt = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const html = await fetchShipmentReceiptHtml(shipmentId);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      if (iframeRef.current) {
        iframeRef.current.src = url;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load receipt");
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    void loadReceipt();
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, [loadReceipt]);

  const handlePrint = async () => {
    const url = previewUrlRef.current;
    if (!url) {
      toast.error("Receipt not loaded yet");
      return;
    }

    setPrinting(true);
    try {
      const printWindow = window.open(url, "_blank", "noopener,noreferrer,width=900,height=1100");
      if (!printWindow) {
        toast.error("Allow pop-ups to print the receipt");
        return;
      }

      await waitForReceiptReady(printWindow);
      printWindow.focus();
      printWindow.print();
    } catch {
      toast.error("Could not open print dialog");
    } finally {
      setPrinting(false);
    }
  };

  const handleOpenTab = () => {
    if (previewUrlRef.current) {
      window.open(previewUrlRef.current, "_blank", "noopener,noreferrer");
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadShipmentReceipt(shipmentId, trackingCode);
      toast.success("Receipt downloaded");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SurfaceCard className="overflow-hidden p-0">
      <div className="receipt-viewer-header sm:px-5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <div>
            <div className="text-sm font-semibold text-foreground">Shipment receipt</div>
            <div className="text-xs text-muted-foreground">
              Waybill for {trackingCode} — opens the official HTML receipt for printing
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={loading}
            onClick={() => void loadReceipt()}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={loading || !!error || printing}
            onClick={() => void handlePrint()}
          >
            {printing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Printer className="mr-1.5 h-3.5 w-3.5" />
            )}
            Print HTML receipt
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={loading || !!error}
            onClick={handleOpenTab}
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Open
          </Button>
          <Button
            type="button"
            size="sm"
            className="btn-action-primary rounded-xl"
            disabled={downloading}
            onClick={() => void handleDownload()}
          >
            {downloading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            Download PDF
          </Button>
        </div>
      </div>

      <div className="receipt-viewer-body">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {error ? (
          <div className="flex min-h-[520px] flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" className="rounded-xl" onClick={() => void loadReceipt()}>
              Try again
            </Button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            title={`Receipt for ${trackingCode}`}
            className="h-[min(75vh,720px)] w-full border-0 bg-zinc-950"
            sandbox="allow-same-origin allow-scripts allow-modals allow-popups"
          />
        )}
      </div>
    </SurfaceCard>
  );
}

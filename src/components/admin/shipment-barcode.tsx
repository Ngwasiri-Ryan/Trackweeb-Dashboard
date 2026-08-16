import { useEffect, useState } from "react";
import { Download, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { SurfaceCard } from "@/components/layout/AppShell";
import { ApiError } from "@/lib/api/client";
import { downloadShipmentBarcode } from "@/lib/api/shipments";
import { generateBarcodeBlob } from "@/lib/barcode";

type ShipmentBarcodeProps = {
  shipmentId: string;
  trackingCode: string;
  onViewReceipt?: () => void;
};

export function ShipmentBarcode({ shipmentId, trackingCode, onViewReceipt }: ShipmentBarcodeProps) {
  const [barcodeSrc, setBarcodeSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    setLoading(true);
    generateBarcodeBlob(trackingCode)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBarcodeSrc(objectUrl);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(error instanceof ApiError ? error.message : "Failed to load barcode");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [trackingCode]);

  const handleDownloadBarcode = async () => {
    setDownloading(true);
    try {
      await downloadShipmentBarcode(shipmentId, trackingCode);
      toast.success("Barcode downloaded");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SurfaceCard className="space-y-4 p-6 text-center" padded={false}>
      <div className="space-y-1">
        <span className="section-heading block text-[11px]">Shipment barcode</span>
        <p className="text-xs text-muted-foreground">
          Generated from the tracking code. Scan with mobile devices or optical scanners to look up.
        </p>
      </div>

      <div className="barcode-frame">
        <div className="flex min-h-16 items-center justify-center">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : barcodeSrc ? (
            <img
              src={barcodeSrc}
              alt={`Barcode for ${trackingCode}`}
              className="max-h-16 w-full max-w-md object-contain"
            />
          ) : (
            <span className="text-sm text-muted-foreground">Barcode unavailable</span>
          )}
        </div>
        <div className="tracking-code mt-1 text-xs tracking-wider">{trackingCode}</div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          type="button"
          disabled={!barcodeSrc || downloading}
          onClick={() => void handleDownloadBarcode()}
          className="barcode-btn"
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          Download barcode
        </button>

        {onViewReceipt ? (
          <button type="button" onClick={onViewReceipt} className="btn-action-primary">
            <Receipt className="h-3.5 w-3.5" />
            View &amp; print official receipt
          </button>
        ) : null}
      </div>
    </SurfaceCard>
  );
}

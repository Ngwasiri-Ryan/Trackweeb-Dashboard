import { brand } from "@/lib/brand";
import type { ShipmentRow } from "./types";
import { finalEta } from "./live-tracking";
import { progressPercent } from "./eta";
import { formatStatus } from "./shipment-utils";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildReceiptHtml(
  shipment: ShipmentRow & { modes?: { display_name: string } },
  tenantName = brand.name,
) {
  const eta = finalEta(shipment);
  const progress = progressPercent(new Date(shipment.depart_time), eta);
  const code = escapeHtml(shipment.tracking_code);
  const siteBase = brand.siteUrl.replace(/\/$/, "");
  const trackUrl = `${typeof window !== "undefined" ? window.location.origin.replace(/:\d+$/, ":5175") : siteBase}/track?code=${encodeURIComponent(shipment.tracking_code)}`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt ${code}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<style>
  body{font-family:system-ui,sans-serif;padding:24px;max-width:720px;margin:0 auto;color:#111}
  h1{font-size:20px;margin:0 0 4px} .meta{color:#666;font-size:13px;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}
  td,th{border:1px solid #ddd;padding:10px;text-align:left}
  th{background:#f5f5f5;width:140px}
  .barcode-wrap{text-align:center;margin:24px 0;padding:16px;border:1px dashed #ccc;border-radius:8px}
  .tracking-code{font-family:ui-monospace,monospace;font-weight:700;letter-spacing:.08em;margin-top:8px}
  @media print{button{display:none}}
</style></head><body>
<h1>${escapeHtml(tenantName)} — Shipment Receipt</h1>
<p class="meta">Official waybill · ${new Date(shipment.created_at).toLocaleString()}</p>
<div class="barcode-wrap">
  <svg id="barcode"></svg>
  <div class="tracking-code">${code}</div>
</div>
<table>
<tr><th>Status</th><td>${escapeHtml(formatStatus(shipment.status))}</td></tr>
<tr><th>From</th><td>${escapeHtml(shipment.origin)}</td></tr>
<tr><th>To</th><td>${escapeHtml(shipment.destination)}</td></tr>
<tr><th>Sender</th><td>${escapeHtml(shipment.sender_name)}</td></tr>
<tr><th>Receiver</th><td>${escapeHtml(shipment.receiver_name)}</td></tr>
<tr><th>Mode</th><td>${escapeHtml(shipment.modes?.display_name ?? "")}</td></tr>
<tr><th>Depart</th><td>${new Date(shipment.depart_time).toLocaleString()}</td></tr>
<tr><th>ETA</th><td>${eta.toLocaleString()}</td></tr>
<tr><th>Progress</th><td>${progress}%</td></tr>
<tr><th>Weight</th><td>${shipment.weight_kg ?? "—"} kg</td></tr>
<tr><th>Track online</th><td><a href="${escapeHtml(trackUrl)}">${escapeHtml(trackUrl)}</a></td></tr>
</table>
<button onclick="window.print()">Print / Save PDF</button>
<script>
  window.__receiptReady = false;
  try {
    JsBarcode("#barcode", ${JSON.stringify(shipment.tracking_code)}, { format: "CODE128", width: 2, height: 60, displayValue: false });
    window.__receiptReady = true;
  } catch (e) { console.error(e); }
<\/script>
</body></html>`;
}

export function openReceiptPrint(shipment: ShipmentRow & { modes?: { display_name: string } }, tenantName?: string) {
  const html = buildReceiptHtml(shipment, tenantName);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

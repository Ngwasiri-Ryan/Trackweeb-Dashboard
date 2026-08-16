import JsBarcode from "jsbarcode";

export function generateBarcodeBlob(trackingCode: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    try {
      JsBarcode(canvas, trackingCode, {
        format: "CODE128",
        width: 2,
        height: 60,
        displayValue: true,
      });
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to generate barcode"));
      }, "image/png");
    } catch (err) {
      reject(err);
    }
  });
}

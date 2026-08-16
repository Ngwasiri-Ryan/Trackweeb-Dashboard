import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function Barcode({ code }: { code: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (ref.current && code) {
      JsBarcode(ref.current, code, { format: "CODE128", width: 2, height: 60, displayValue: true });
    }
  }, [code]);

  return (
    <div className="barcode">
      <svg ref={ref} />
    </div>
  );
}

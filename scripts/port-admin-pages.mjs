#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const adminRoutes = path.join(root, "Tracking-Admin/src/routes");
const pagesDir = path.join(root, "trackweeb-dashboard/src/pages");

const mappings = [
  ["login.tsx", "Login.tsx"],
  ["dashboard.tsx", "Dashboard.tsx"],
  ["live-map.tsx", "LiveMap.tsx"],
  ["api-keys.tsx", "ApiKeys.tsx"],
  ["settings.tsx", "Settings.tsx"],
  ["routes/index.tsx", "Routes.tsx"],
  ["shipments/index.tsx", "Shipments.tsx"],
  ["shipments/new.tsx", "ShipmentNew.tsx"],
  ["shipments/scan.tsx", "Scan.tsx"],
  ["shipments/$id/index.tsx", "ShipmentDetail.tsx"],
  ["shipments/$id.edit.tsx", "ShipmentEdit.tsx"],
];

function transform(content, filename) {
  let out = content;

  out = out.replace(/export const Route = createFileRoute[\s\S]*?\);\n\n?/g, "");
  out = out.replace(/^import \{ createFileRoute[^}]+\} from "@tanstack\/react-router";\n/gm, "");
  out = out.replace(
    /^import \{ createFileRoute, ([^}]+) \} from "@tanstack\/react-router";\n/gm,
    'import { $1 } from "@/lib/router-compat";\n',
  );
  out = out.replace(
    /^import \{ ([^}]+) \} from "@tanstack\/react-router";\n/gm,
    (match, imports) => {
      if (imports.includes("createFileRoute")) return "";
      return `import { ${imports} } from "@/lib/router-compat";\n`;
    },
  );
  out = out.replace(/import \{ requireAuth \} from "@\/lib\/route-guards";\n/g, "");
  out = out.replace(/import \{ redirectIfAuthed \} from "@\/lib\/route-guards";\n/g, "");

  if (filename === "Shipments.tsx") {
    out = out.replace(/const search = Route\.useSearch\(\);/g, "const search = useShipmentsSearch();");
    out = out.replace(/const navigate = Route\.useNavigate\(\);/g, "const navigate = useNavigate();");
    if (!out.includes("function useShipmentsSearch")) {
      const hook = `
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

`;
      out = out.replace(
        /(import \{ useNavigate \} from "@\/lib\/router-compat";)/,
        '$1\nimport { useSearchParams } from "react-router-dom";',
      );
      out = out.replace(/const PAGE_SIZE = 15;/, `${hook}const PAGE_SIZE = 15;`);
    }
  }

  if (filename === "ShipmentDetail.tsx" || filename === "ShipmentEdit.tsx") {
    out = out.replace(/Route\.useParams\(\)/g, "useParams()");
    if (!out.includes('from "react-router-dom"') && out.includes("useParams()")) {
      out = out.replace(
        /(import \{[^}]+\} from "@\/lib\/router-compat";)/,
        '$1\nimport { useParams } from "react-router-dom";',
      );
    }
  }

  out = out.replace(/^function (\w+Page)\(/m, "export default function $1(");

  return out;
}

for (const [src, dest] of mappings) {
  const srcPath = path.join(adminRoutes, src);
  const destPath = path.join(pagesDir, dest);
  if (!fs.existsSync(srcPath)) {
    console.warn(`Skip missing: ${srcPath}`);
    continue;
  }
  const raw = fs.readFileSync(srcPath, "utf8");
  const transformed = transform(raw, dest);
  fs.writeFileSync(destPath, transformed);
  console.log(`Wrote ${dest}`);
}

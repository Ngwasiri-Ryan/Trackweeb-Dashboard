import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  MapPin,
  Package,
  Route,
  ScanBarcode,
  Settings,
  KeyRound,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export type NavSection = {
  id: string;
  group: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    id: "overview",
    group: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/live-map", label: "Live map", icon: MapPin },
    ],
  },
  {
    id: "operations",
    group: "Operations",
    items: [
      { to: "/shipments", label: "Shipments", icon: Package },
      { to: "/shipments/scan", label: "Scan barcode", icon: ScanBarcode },
      { to: "/routes", label: "Routes", icon: Route },
    ],
  },
  {
    id: "account",
    group: "Account",
    items: [
      { to: "/api-keys", label: "API keys", icon: KeyRound },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function sectionIdForPath(path: string) {
  for (const section of navSections) {
    if (section.items.some((item) => path === item.to || path.startsWith(`${item.to}/`))) {
      return section.id;
    }
  }
  return null;
}

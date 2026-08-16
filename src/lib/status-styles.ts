import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Package,
  PlaneLanding,
  Truck,
} from "lucide-react";

export type StatusStyle = {
  icon: LucideIcon;
  badgeClass: string;
  dotClass: string;
  ringClass: string;
  ping?: boolean;
};

function statusClass(status: string) {
  const slug = status.replace(/_/g, "-");
  return `status-badge status-badge--${slug}`;
}

export const STATUS_STYLES: Record<string, StatusStyle> = {
  booked: {
    icon: Package,
    badgeClass: statusClass("booked"),
    dotClass: "status-badge__dot",
    ringClass: "ring-border",
  },
  departed: {
    icon: Truck,
    badgeClass: statusClass("departed"),
    dotClass: "status-badge__dot",
    ringClass: "ring-border",
  },
  in_transit: {
    icon: Truck,
    badgeClass: statusClass("in_transit"),
    dotClass: "status-badge__dot",
    ringClass: "ring-primary/30",
    ping: true,
  },
  arrived: {
    icon: PlaneLanding,
    badgeClass: statusClass("arrived"),
    dotClass: "status-badge__dot",
    ringClass: "ring-warning/30",
  },
  delivered: {
    icon: CheckCircle2,
    badgeClass: statusClass("delivered"),
    dotClass: "status-badge__dot",
    ringClass: "ring-success/30",
  },
  delayed: {
    icon: AlertTriangle,
    badgeClass: statusClass("delayed"),
    dotClass: "status-badge__dot",
    ringClass: "ring-destructive/30",
  },
  out_for_delivery: {
    icon: MapPin,
    badgeClass: statusClass("out_for_delivery"),
    dotClass: "status-badge__dot",
    ringClass: "ring-warning/30",
  },
};

const FALLBACK_STYLE: StatusStyle = {
  icon: Package,
  badgeClass: statusClass("booked"),
  dotClass: "status-badge__dot",
  ringClass: "ring-border",
};

export function getStatusStyle(status: string): StatusStyle {
  return STATUS_STYLES[status] ?? FALLBACK_STYLE;
}

/** @deprecated Use getStatusStyle().badgeClass or ShipmentStatusBadge */
export function statusBadgeClass(status: string) {
  return getStatusStyle(status).badgeClass;
}

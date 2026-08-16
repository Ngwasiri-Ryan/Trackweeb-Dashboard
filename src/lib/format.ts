import { format, formatDistanceToNow, parseISO } from "date-fns";

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MMM d, yyyy · h:mm a");
  } catch {
    return iso;
  }
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

export function formatRelative(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

/** Human-readable duration from hours (v=d/t result). */
export function formatDurationFromHours(hours: number | null | undefined): string {
  if (hours == null || hours <= 0 || !Number.isFinite(hours)) return "—";
  const totalMinutes = Math.max(1, Math.round(hours * 60));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hrs = Math.floor((totalMinutes % (24 * 60)) / 60);
  const mins = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hrs > 0) parts.push(`${hrs} hr${hrs === 1 ? "" : "s"}`);
  if (mins > 0 && days === 0) parts.push(`${mins} min${mins === 1 ? "" : "s"}`);
  return parts.join(" ") || "1 min";
}

const STATUS_LABELS: Record<string, string> = {
  booked: "Booked",
  departed: "Departed",
  in_transit: "In transit",
  arrived: "Arrived",
  delivered: "Delivered",
};

export function formatStatus(status: string) {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export { statusBadgeClass } from "./status-styles";

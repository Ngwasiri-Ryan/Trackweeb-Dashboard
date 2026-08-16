import {
  getDashboardSummary,
  getDelayedShipments,
  getDeliveryPerformance,
  getLiveMapShipments,
  getLiveUpdates,
  getRecentActivity,
  getStatsActivity,
  getStatsByMode,
  getStatsByStatus,
  searchShipments,
} from "../dashboard-service";
import { toShipmentSummary } from "../shipment-mapper";

export type DashboardSummary = Awaited<ReturnType<typeof getDashboardSummary>> & { timezone?: string };

export function fetchDashboardSummary(date?: string) {
  return getDashboardSummary(date).then((s) => ({
    ...s,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }));
}

export function fetchDelayedShipments() {
  return getDelayedShipments().then((rows) => ({
    data: rows.map((r) =>
      toShipmentSummary({
        ...(r as Parameters<typeof toShipmentSummary>[0]),
        delays: (r as { delays?: Parameters<typeof toShipmentSummary>[0]["delays"] }).delays,
      }),
    ),
    meta: { total: rows.length },
  }));
}

export function fetchStatsByMode() {
  return getStatsByMode().then((data) => ({ data }));
}

export function fetchStatsByStatus() {
  return getStatsByStatus().then((data) => ({ data }));
}

export function fetchDeliveryPerformance(from?: string, to?: string) {
  return getDeliveryPerformance(from, to);
}

export function fetchStatsActivity(from?: string, to?: string) {
  return getStatsActivity(from, to).then((data) => ({
    granularity: "day",
    data,
  }));
}

export function fetchRecentActivity(limit = 20) {
  return getRecentActivity(limit).then((data) => ({ data }));
}

export function fetchLiveMap(params?: { status?: string; mode_id?: string; is_delayed?: boolean }) {
  return getLiveMapShipments(params).then((data) => ({
    updated_at: new Date().toISOString(),
    count: data.length,
    data,
  }));
}

export function fetchLiveUpdates(since: string) {
  return getLiveUpdates(since);
}

export function globalSearch(q: string) {
  return searchShipments(q).then((rows) => ({
    data: rows.map((r) => ({
      type: "shipment",
      id: r.id,
      tracking_code: r.tracking_code,
      label: `${r.receiver_name} → ${r.destination}`,
      status: r.status,
    })),
  }));
}

export type SearchResult = {
  type: string;
  id: string;
  tracking_code: string;
  label: string;
  status: string;
};

export type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; total_pages: number };
};

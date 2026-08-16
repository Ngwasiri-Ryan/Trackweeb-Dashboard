export const TRACKING_CODE_REGEX = /^TRK-\d{4}-[RASL]-\d{6}$/;

export const STATUS_ORDER: Record<string, number> = {
  booked: 1,
  departed: 2,
  in_transit: 3,
  arrived: 4,
  delivered: 5,
};

export function normalizeTrackingCode(input: string): string {
  const trimmed = input.trim().toUpperCase();
  if (TRACKING_CODE_REGEX.test(trimmed)) return trimmed;
  const compact = trimmed.replace(/[^A-Z0-9]/g, "");
  const match = compact.match(/^TRK(\d{4})([RASL])(\d{6})$/);
  if (match) return `TRK-${match[1]}-${match[2]}-${match[3]}`;
  return trimmed;
}

export function isValidManualTrackingCode(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  if (normalized.length < 3 || normalized.length > 50) return false;
  return /^[A-Z0-9-]+$/.test(normalized);
}

export function canTransitionStatus(from: string, to: string): boolean {
  const fromOrder = STATUS_ORDER[from];
  const toOrder = STATUS_ORDER[to];
  if (fromOrder === undefined || toOrder === undefined) return false;
  return toOrder >= fromOrder;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function formatStatus(code: string): string {
  return code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

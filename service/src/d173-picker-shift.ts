/**
 * D173-E123: Picker-only automatic shift logout.
 * All stored login times in InventoryCore SQLite are UTC, without an offset.
 * Compute the next cutoff from the authoritative login timestamp, never a PDA clock.
 * Before 10:00 VN -> 14:00 same day; from 10:00 to before 22:00 -> 22:00.
 * After 22:00 is a NEW overtime login; its next cutoff is 22:00 the following day.
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
function parseUtcSqliteTimestamp(value: string | null | undefined): number {
  const raw = String(value || "").trim();
  if (!raw) return NaN;
  // SQLite CURRENT_TIMESTAMP emits "YYYY-MM-DD HH:MM:SS" in UTC.
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
    ? raw.replace(" ", "T") + "Z" : raw;
  return Date.parse(iso);
}
export function d173PickerShiftLogoutAtMs(startedAt: string | null | undefined): number | null {
  const utc = parseUtcSqliteTimestamp(startedAt);
  if (!Number.isFinite(utc)) return null;
  const local = utc + VN_OFFSET_MS;
  const startOfLocalDay = Math.floor(local / DAY_MS) * DAY_MS;
  const minutes = (local - startOfLocalDay) / 60000;
  const cutoff = minutes < 600 ? 14 * 60 : minutes < 1320 ? 22 * 60 : 24 * 60 + 22 * 60;
  return startOfLocalDay + cutoff * 60000 - VN_OFFSET_MS;
}
export function d173PickerShiftIsExpired(startedAt: string | null | undefined, nowMs: number): boolean {
  const at = d173PickerShiftLogoutAtMs(startedAt);
  return at === null || !Number.isFinite(nowMs) || nowMs >= at;
}

/**
 * D167 — pure WMS source normalization and daily-slot reconciliation.
 * No WMS credentials, browser traffic, provider calls or storage side-effects here.
 * The caller MUST validate that the file is the complete authorized HY1 export.
 */
export type D167Slot = "INITIAL_05" | "DELTA_12" | "DELTA_19";
export type D167Area = "LTA" | "SHELVING" | "UNKNOWN";
export type D167JobMode = "FULL" | "DELTA";

export interface D167SourceRow {
  sku: string;
  product_name: string;
  storage_location?: string | null;
  pickable?: boolean | null;
  // Presence is independently validated from header. Missing field is NOT "no pickable".
}
export interface D167Sku {
  sku: string;
  product_name: string;
  area: D167Area;
  area_verified: boolean;
  area_reason: string;
}
export interface D167CatalogRow extends D167Sku {
  active: boolean;
  last_wms_name: string | null;
  last_wms_area: D167Area | null;
  manual_name_revision: number;
  manual_area_revision: number;
}
export interface D167Diff {
  create: D167Sku[];
  update: Array<{ sku: string; name?: string; area?: D167Area; area_verified?: boolean }>;
  activate: string[];
  hide: string[];
  conflicts: Array<{ sku: string; field: "product_name" | "area"; current: string; incoming: string }>;
  unchanged: number;
}

export function vnDayAt(ms: number): string {
  if (!Number.isFinite(ms)) throw new Error("INVALID_TIME");
  return new Date(ms + 7 * 3600_000).toISOString().slice(0, 10);
}

export function slotMode(slot: D167Slot): D167JobMode {
  return slot === "INITIAL_05" ? "FULL" : "DELTA";
}

export function slotWindow(slot: D167Slot, day: string): { start_ms: number; end_ms: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(day + "T00:00:00Z").toISOString().slice(0, 10) !== day)
    throw new Error("INVALID_VN_DAY");
  const hh = slot === "INITIAL_05" ? 5 : slot === "DELTA_12" ? 12 : slot === "DELTA_19" ? 19 : -1;
  if (hh < 0) throw new Error("INVALID_SLOT");
  const start = Date.parse(day + "T00:00:00Z") + (hh - 7) * 3600_000;
  return { start_ms: start, end_ms: slot === "INITIAL_05" ? start : start + 15 * 60_000 };
}

/** Random target must be chosen ONCE by InventoryCore then persisted for HA agents. */
export function randomSlotTarget(slot: D167Slot, day: string, randomFraction: number): number {
  const window = slotWindow(slot, day);
  if (slot === "INITIAL_05") return window.start_ms;
  if (!Number.isFinite(randomFraction) || randomFraction < 0 || randomFraction >= 1)
    throw new Error("INVALID_RANDOM_FRACTION");
  return window.start_ms + Math.floor(randomFraction * (window.end_ms - window.start_ms));
}

export function classifyCoarseArea(location: string): D167Area {
  const value = String(location || "").trim().toUpperCase();
  if (/^LTA(?:\.|$)/.test(value)) return "LTA";
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) return "SHELVING";
  return "UNKNOWN";
}

export function normalizeSourceRows(
  rows: D167SourceRow[],
  options: { site_verified: boolean; location_header_present: boolean },
): D167Sku[] {
  if (!options.site_verified) throw new Error("WMS_SITE_UNVERIFIED");
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 50_000) throw new Error("WMS_SOURCE_SIZE_INVALID");
  const groups = new Map<string, { name: string; areas: Set<D167Area>; pickable_count: number; invalid: boolean }>();
  for (const row of rows) {
    const sku = String(row.sku ?? "").trim();
    const product_name = String(row.product_name ?? "").trim().replace(/\s+/g, " ").normalize("NFC");
    if (!sku || !product_name || sku.length > 128 || product_name.length > 500 || /\r|\n/.test(sku))
      throw new Error("WMS_INVALID_SKU_OR_NAME");
    let g = groups.get(sku);
    if (!g) { g = { name: product_name, areas: new Set(), pickable_count: 0, invalid: false }; groups.set(sku, g); }
    if (g.name !== product_name) throw new Error("WMS_DUPLICATE_SKU_CONFLICTING_NAMES");
    if (options.location_header_present && row.pickable === true) {
      g.pickable_count += 1;
      const area = classifyCoarseArea(String(row.storage_location ?? ""));
      if (area === "UNKNOWN") g.invalid = true;
      else g.areas.add(area);
    }
  }
  return [...groups].map(([sku, g]) => {
    const area_verified = options.location_header_present && !g.invalid && g.areas.size <= 1;
    const area: D167Area = area_verified && g.areas.size === 1 ? [...g.areas][0] : "UNKNOWN";
    const area_reason = !options.location_header_present ? "MISSING_AREA_COLUMN"
      : g.invalid ? "INVALID_PICKABLE_LOCATION"
      : g.areas.size > 1 ? "MULTIPLE_AREA"
      : g.pickable_count === 0 ? "NO_PICKABLE_LOCATION" : "VERIFIED";
    return { sku, product_name: g.name, area, area_verified, area_reason };
  }).sort((a, b) => a.sku.localeCompare(b.sku));
}

/**
 * WMS-vs-Web field conflict: only when current field was manually changed after
 * the previous WMS observation AND the new WMS source also changed that field.
 * Repeated source data must not undo the user's manual edit.
 */
export function planSkuChanges(
  existing: D167CatalogRow[], incoming: D167Sku[], mode: D167JobMode,
  baselineRevision: number,
): D167Diff {
  const bySku = new Map(existing.map(row => [row.sku, row]));
  const seen = new Set<string>();
  const plan: D167Diff = { create: [], update: [], activate: [], hide: [], conflicts: [], unchanged: 0 };
  for (const row of incoming) {
    if (seen.has(row.sku)) throw new Error("SOURCE_DUPLICATE_SKU");
    seen.add(row.sku);
    const prev = bySku.get(row.sku);
    if (!prev) { plan.create.push(row); continue; }
    if (!prev.active) plan.activate.push(row.sku);
    const change: { sku: string; name?: string; area?: D167Area; area_verified?: boolean } = { sku: row.sku };
    const wmsNameChanged = prev.last_wms_name === null || prev.last_wms_name !== row.product_name;
    if (wmsNameChanged && prev.product_name !== row.product_name) {
      if (prev.manual_name_revision > baselineRevision) plan.conflicts.push({
        sku: row.sku, field: "product_name", current: prev.product_name, incoming: row.product_name,
      }); else change.name = row.product_name;
    }
    const wmsAreaChanged = row.area_verified && (prev.last_wms_area === null || prev.last_wms_area !== row.area);
    if (wmsAreaChanged && prev.area !== row.area) {
      if (prev.manual_area_revision > baselineRevision) plan.conflicts.push({
        sku: row.sku, field: "area", current: prev.area, incoming: row.area,
      }); else { change.area = row.area; change.area_verified = true; }
    }
    if (change.name !== undefined || change.area !== undefined) plan.update.push(change);
    else if (prev.active) plan.unchanged += 1;
  }
  if (mode === "FULL") for (const prev of existing) if (prev.active && !seen.has(prev.sku)) plan.hide.push(prev.sku);
  return plan;
}

/** D167 InventoryCore-only three-slot SKU ledger and atomic sparse publish.
 * No public route may forward here without a verified Agent PRIMARY/generation.
 */
import { planSkuChanges, randomSlotTarget, slotMode,
  vnDayAt, type D167Slot, type D167Sku, type D167CatalogRow, type D167Area } from "./d167-sku-sync-logic";

type Row = Record<string, string | number | null>;
const SLOTS: D167Slot[] = ["INITIAL_05", "DELTA_12", "DELTA_19"];
const JKEY = "HY1_SKU_MASTER";
const response = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
function row(state: DurableObjectState, sql: string, ...args: SqlStorageValue[]): Row | null {
  return state.storage.sql.exec<Row>(sql, ...args).toArray()[0] ?? null;
}
function safeSlot(v: unknown): D167Slot | null {
  return SLOTS.includes(v as D167Slot) ? v as D167Slot : null;
}
function guard(input: Record<string, unknown>, job: Row): boolean {
  return String(input.instance_id || "") === String(job.owner_id || "")
    && String(input.generation || "") === String(job.generation || "")
    && Number(job.lease_until_ms || 0) > Date.now();
}

export function initializeD167SkuSyncSchema(state: DurableObjectState): void {
  state.storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS d167_sku_jobs (
      day_vn TEXT NOT NULL, slot TEXT NOT NULL, job_key TEXT NOT NULL DEFAULT 'HY1_SKU_MASTER',
      state TEXT NOT NULL DEFAULT 'READY', scheduled_at_ms INTEGER NOT NULL,
      owner_id TEXT, generation TEXT, lease_until_ms INTEGER NOT NULL DEFAULT 0,
      fingerprint TEXT, total_rows INTEGER NOT NULL DEFAULT 0, expected_revision INTEGER NOT NULL DEFAULT 0,
      complete_at TEXT, receipt_json TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (day_vn,slot)
    );
    CREATE TABLE IF NOT EXISTS d167_sku_stage (
      day_vn TEXT NOT NULL, slot TEXT NOT NULL, sku TEXT NOT NULL,
      product_name TEXT NOT NULL, area TEXT NOT NULL, area_verified INTEGER NOT NULL,
      area_reason TEXT NOT NULL,
      PRIMARY KEY (day_vn,slot,sku)
    );
    CREATE TABLE IF NOT EXISTS d167_sku_meta (
      id INTEGER PRIMARY KEY CHECK (id=1), revision INTEGER NOT NULL DEFAULT 0,
      last_full_day TEXT, published_at TEXT,
      membership_changed_at TEXT
    );
    INSERT OR IGNORE INTO d167_sku_meta (id,revision) VALUES (1,0);
    CREATE TABLE IF NOT EXISTS d167_sku_active (
      sku TEXT PRIMARY KEY, active INTEGER NOT NULL CHECK(active IN (0,1)),
      area TEXT NOT NULL DEFAULT 'UNKNOWN',
      area_verified INTEGER NOT NULL DEFAULT 0,
      last_wms_name TEXT, last_wms_area TEXT, last_wms_observed_at TEXT,
      last_web_name_at TEXT, last_web_area_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_d167_sku_active_on ON d167_sku_active(active,sku);
    CREATE TABLE IF NOT EXISTS d167_sku_area_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT NOT NULL, area TEXT NOT NULL,
      effective_from TEXT NOT NULL, effective_to TEXT,
      day_vn TEXT NOT NULL, source_slot TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_d167_area_sku_time
      ON d167_sku_area_history(sku,effective_from DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_d167_area_one_open
      ON d167_sku_area_history(sku) WHERE effective_to IS NULL;
  `);
}

function ensureSchedule(state: DurableObjectState, day: string): Row[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day + "T00:00:00Z")))
    throw new Error("INVALID_DAY");
  return state.storage.transactionSync(() => {
    for (const slot of SLOTS) {
      const old = row(state, "SELECT day_vn FROM d167_sku_jobs WHERE day_vn=? AND slot=?", day, slot);
      if (old) continue;
      const scheduled = randomSlotTarget(slot, day, Math.random());
      state.storage.sql.exec(`INSERT INTO d167_sku_jobs (day_vn,slot,scheduled_at_ms)
        VALUES (?,?,?)`, day, slot, scheduled);
    }
    // The evening job supersedes an uncompleted noon DELTA. Never let a
    // delayed primary retry publish a stale noon snapshot after evening.
    const evening = row(state,
      "SELECT scheduled_at_ms FROM d167_sku_jobs WHERE day_vn=? AND slot='DELTA_19'",
      day);
    if (evening && Date.now() >= Number(evening.scheduled_at_ms)) {
      const now = new Date().toISOString();
      const receipt = JSON.stringify({ day_vn:day, slot:"DELTA_12",
        reason:"COALESCED_INTO_DELTA_19", skipped_at:now });
      state.storage.sql.exec(`UPDATE d167_sku_jobs
        SET state='SKIPPED', receipt_json=?, lease_until_ms=0, updated_at=?
        WHERE day_vn=? AND slot='DELTA_12'
          AND state NOT IN ('DONE','SKIPPED')`, receipt,now,day);
    }
    return state.storage.sql.exec<Row>(
      "SELECT day_vn,slot,state,scheduled_at_ms,complete_at,receipt_json FROM d167_sku_jobs WHERE day_vn=? ORDER BY scheduled_at_ms",
      day,
    ).toArray();
  });
}

function rosterRows(state: DurableObjectState): D167CatalogRow[] {
  const list = state.storage.sql.exec<Row>(`
    SELECT s.sku,s.product_name,a.active,a.area,a.area_verified,a.last_wms_name,a.last_wms_area,
      a.last_web_name_at,a.last_web_area_at
    FROM sku_master s LEFT JOIN d167_sku_active a ON a.sku=s.sku
    ORDER BY s.sku
  `).toArray();
  return list.map(x => ({
    sku: String(x.sku), product_name: String(x.product_name),
    active: x.active == null || Number(x.active) === 1,
    has_active_record: x.active != null,
    area: String(x.area || "UNKNOWN") as D167Area,
    area_verified: Number(x.area_verified || 0) === 1,
    area_reason: "CACHED",
    last_wms_name: x.last_wms_name == null ? null : String(x.last_wms_name),
    last_wms_area: x.last_wms_area == null ? null : String(x.last_wms_area) as D167Area,
    manual_name_revision: x.last_web_name_at ? Date.parse(String(x.last_web_name_at)) : 0,
    manual_area_revision: x.last_web_area_at ? Date.parse(String(x.last_web_area_at)) : 0,
    last_wms_observed_ms: x.last_wms_observed_at ? Date.parse(String(x.last_wms_observed_at)) : 0,
  }));
}
function auditArea(state: DurableObjectState, item: D167Sku, day: string, slot: string, at: string): void {
  if (!item.area_verified && !["MULTIPLE_AREA","INVALID_PICKABLE_LOCATION"].includes(item.area_reason)) return;
  const prev = row(state, "SELECT area FROM d167_sku_area_history WHERE sku=? AND effective_to IS NULL", item.sku);
  if (prev && prev.area === item.area) return;
  if (prev) state.storage.sql.exec("UPDATE d167_sku_area_history SET effective_to=? WHERE sku=? AND effective_to IS NULL", at, item.sku);
  state.storage.sql.exec(
    "INSERT INTO d167_sku_area_history (sku,area,effective_from,day_vn,source_slot) VALUES (?,?,?,?,?)",
    item.sku, item.area, at, day, slot,
  );
}

export async function handleD167SkuCoreRequest(state: DurableObjectState, request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/d167/skus/")) return null;
  const action = url.pathname.slice("/d167/skus/".length);
  if (!["schedule", "claim", "stage", "preview", "publish", "status"].includes(action))
    return response({ error: "NOT_FOUND" }, 404);
  let body: Record<string, unknown> = {};
  if (request.method === "POST") {
    try {
      const value = await request.json();
      if (!value || typeof value !== "object" || Array.isArray(value)) return response({ error: "INVALID_JSON" }, 400);
      body = value as Record<string, unknown>;
    } catch { return response({ error: "INVALID_JSON" }, 400); }
  }
  const day = String(body.day_vn || url.searchParams.get("day_vn") || vnDayAt(Date.now()));
  if (day !== vnDayAt(Date.now())) return response({ error: "DAY_NOT_CURRENT" }, 409);
  const slot = safeSlot(body.slot || url.searchParams.get("slot"));
  if (action === "schedule" && request.method === "GET") {
    return response({ day_vn: day, slots: ensureSchedule(state, day) });
  }
  if (!slot) return response({ error: "INVALID_SLOT" }, 400);
  ensureSchedule(state, day);
  const job = row(state, "SELECT * FROM d167_sku_jobs WHERE day_vn=? AND slot=?", day, slot);
  if (!job) return response({ error: "JOB_MISSING" }, 500);
  if (action === "status" && request.method === "GET")
    return response({ slot, day_vn: day, state: job.state, scheduled_at_ms: job.scheduled_at_ms,
      complete_at: job.complete_at, receipt: job.receipt_json ? JSON.parse(String(job.receipt_json)) : null });
  if (request.method !== "POST") return response({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (job.state === "DONE") return response({ status: "DONE", receipt: JSON.parse(String(job.receipt_json || "{}")) });
  if (job.state === "SKIPPED") return response({ error:"SLOT_COALESCED_INTO_EVENING",receipt:job.receipt_json },409);
  if (Date.now() < Number(job.scheduled_at_ms)) return response({ error: "NOT_SCHEDULED_YET" }, 409);
  const instance = String(body.instance_id || "");
  const generation = String(body.generation || "");
  if (!/^[A-Za-z0-9:_-]{6,150}$/.test(instance) || !/^[A-Za-z0-9-]{16,150}$/.test(generation))
    return response({ error: "INVALID_PRIMARY_PROOF" }, 403);

  if (action === "claim") {
    const previousFull = row(state,
      "SELECT complete_at FROM d167_sku_jobs WHERE day_vn=? AND slot='INITIAL_05' AND state='DONE'", day);
    if (slot !== "INITIAL_05" && !previousFull)
      return response({ error: "INITIAL_FULL_REQUIRED" }, 409);
    if (Number(job.lease_until_ms || 0) > Date.now()
      && String(job.generation || "") === generation && String(job.owner_id || "") !== instance)
      return response({ error: "JOB_LEASED" }, 409);
    // Fingerprint fast path: midday/evening complete WMS export is byte-for-byte
    // semantically unchanged vs the last verified source. No 2500-SKU staging,
    // no catalog UPDATE and no area-history event; one tiny slot receipt only.
    const proposedFingerprint = String(body.fingerprint || "").trim().toLowerCase();
    const proposedCount = Number(body.source_rows);
    if (slot !== "INITIAL_05" && /^[a-f0-9]{64}$/.test(proposedFingerprint) &&
        Number.isSafeInteger(proposedCount) && proposedCount >= 1 && proposedCount <= 5000) {
      const priorSlot = slot === "DELTA_12" ? "INITIAL_05" : "DELTA_12";
      let prior = row(state,
        "SELECT fingerprint,total_rows FROM d167_sku_jobs WHERE day_vn=? AND slot=? AND state='DONE'",
        day, priorSlot);
      if (!prior && slot === "DELTA_19") prior = row(state,
        "SELECT fingerprint,total_rows FROM d167_sku_jobs WHERE day_vn=? AND slot='INITIAL_05' AND state='DONE'",
        day);
      if (prior && prior.fingerprint === proposedFingerprint &&
          Number(prior.total_rows) === proposedCount) {
        const done = state.storage.transactionSync(() => {
          const current = row(state,
            "SELECT state FROM d167_sku_jobs WHERE day_vn=? AND slot=?",day,slot);
          if (!current || current.state === "DONE") return false;
          const at = new Date().toISOString();
          const receipt = JSON.stringify({
            day_vn:day,slot,source_rows:proposedCount,
            fingerprint:proposedFingerprint,created:0,updated:0,
            activated:0,hidden:0,unchanged:proposedCount,
            source_unchanged:true,completed_at:at
          });
          state.storage.sql.exec(`UPDATE d167_sku_jobs SET state='DONE', fingerprint=?,
            total_rows=?,complete_at=?,receipt_json=?,owner_id=?,generation=?,
            lease_until_ms=0,updated_at=? WHERE day_vn=? AND slot=?`,
            proposedFingerprint,proposedCount,at,receipt,instance,generation,at,day,slot);
          return true;
        });
        if (!done) return response({error:"JOB_CHANGED"},409);
        return response({status:"DONE",slot,day_vn:day,
          source_unchanged:true,staging_rows_written:0});
      }
    }
    // The WORKER verifies that this generation and instance are current Firebase HA PRIMARY
    // immediately before forwarding every POST; the DO fence protects in-flight prior leaders.
    const rev = row(state,"SELECT revision FROM d167_sku_meta WHERE id=1");
    state.storage.sql.exec(`UPDATE d167_sku_jobs SET owner_id=?,generation=?,
      lease_until_ms=?,state='CLAIMED',expected_revision=?,updated_at=? WHERE day_vn=? AND slot=?`,
      instance, generation, Date.now() + 15 * 60_000,Number(rev?.revision||0),new Date().toISOString(), day, slot);
    if (job.generation && job.generation !== generation) state.storage.sql.exec(
      "DELETE FROM d167_sku_stage WHERE day_vn=? AND slot=?", day, slot);
    return response({ status: "CLAIMED", slot, day_vn: day, mode: slotMode(slot), lease_expires_in_ms: 15*60_000 });
  }
  if (!guard(body, job)) return response({ error: "HA_FENCED_OR_EXPIRED" }, 409);
  if (action === "stage") {
    const items = body.items;
    if (!Array.isArray(items) || !items.length || items.length > 1000) return response({ error: "INVALID_CHUNK_SIZE" }, 400);
    if (!["CLAIMED", "STAGING"].includes(String(job.state))) return response({ error: "JOB_NOT_STAGING" }, 409);
    const expectedCount = Number(body.expected_count);
    if (!Number.isSafeInteger(expectedCount) || expectedCount < 1 || expectedCount > 5_000 ||
        !/^[a-f0-9]{64}$/.test(String(body.fingerprint || "").trim().toLowerCase()))
      return response({ error: "INVALID_MANIFEST" }, 400);
    if (job.fingerprint && (String(job.fingerprint) !== String(body.fingerprint) || Number(job.total_rows) !== expectedCount))
      return response({ error: "SOURCE_CHANGED_DURING_STAGING" }, 409);
    const seen = new Set<string>();
    for (const item of items as Array<Record<string, unknown>>) {
      const sku = String(item.sku || "").trim();
      if (!sku || sku.length > 128 || seen.has(sku)) return response({ error: "INVALID_OR_DUPLICATE_SKU" }, 400);
      seen.add(sku);
      const name = String(item.product_name || "").trim();
      const area = String(item.area || "UNKNOWN");
      if (!name || name.length > 500 || !["LTA","SHELVING","UNKNOWN"].includes(area)) return response({ error: "INVALID_SKU_FIELDS" }, 400);
    }
    state.storage.transactionSync(() => {
      state.storage.sql.exec("UPDATE d167_sku_jobs SET state='STAGING',fingerprint=?,total_rows=?,updated_at=? WHERE day_vn=? AND slot=?",
        String(body.fingerprint || ""), expectedCount, new Date().toISOString(), day, slot);
      for (const item of items as Array<Record<string, unknown>>) {
        state.storage.sql.exec(`INSERT INTO d167_sku_stage
          (day_vn,slot,sku,product_name,area,area_verified,area_reason)
          VALUES (?,?,?,?,?,?,?)
          ON CONFLICT(day_vn,slot,sku) DO UPDATE SET
          product_name=excluded.product_name,area=excluded.area,
          area_verified=excluded.area_verified,area_reason=excluded.area_reason`,
          day, slot, String(item.sku).trim(), String(item.product_name).trim(),
          String(item.area || "UNKNOWN"), item.area_verified === true ? 1 : 0,
          String(item.area_reason || "UNKNOWN"));
      }
    });
    const staged = row(state,"SELECT COUNT(*) AS n FROM d167_sku_stage WHERE day_vn=? AND slot=?",day,slot);
    return response({ staged: staged?.n, expected: expectedCount });
  }
  if (action === "preview" || action === "publish") {
    const entries = state.storage.sql.exec<Row>(
      "SELECT sku,product_name,area,area_verified,area_reason FROM d167_sku_stage WHERE day_vn=? AND slot=? ORDER BY sku",
      day, slot).toArray();
    if (!entries.length || entries.length !== Number(job.total_rows) || !job.fingerprint)
      return response({ error: "INCOMPLETE_SOURCE_MANIFEST" }, 409);
    const staged: D167Sku[] = entries.map(item => ({
      sku:String(item.sku),product_name:String(item.product_name),
      area:String(item.area) as D167Area,area_verified:Number(item.area_verified)===1,
      area_reason:String(item.area_reason),
    }));
    // Verify the entire canonical SKU/name/area manifest on the trusted Service,
    // not a client-supplied fingerprint or a sparse three-row readback.
    const canonical = staged.map(x => [
      x.sku, x.product_name, x.area, x.area_verified ? "1" : "0", x.area_reason,
    ].join("\t")).join("\n");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
    const computed = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2,"0")).join("");
    if (computed !== String(job.fingerprint).toLowerCase())
      return response({ error:"SOURCE_FINGERPRINT_MISMATCH" },409);
    const existing = rosterRows(state);
    const meta = row(state,"SELECT revision,last_full_day,published_at FROM d167_sku_meta WHERE id=1") || {};
    const baseTime = meta.published_at ? Date.parse(String(meta.published_at)) : 0;
    const plan = planSkuChanges(existing,staged,slotMode(slot),baseTime);
    const existingBySku = new Map(existing.map(x => [x.sku,x]));
    const changedSkus = new Set([
      ...plan.create.map(x=>x.sku), ...plan.update.map(x=>x.sku), ...plan.activate,
      ...plan.conflicts.map(x=>x.sku),
    ]);
    const updates = new Map(plan.update.map(x => [x.sku,x]));
    // D167 source-completeness safety: a structurally valid but truncated WMS
    // export must not silently hide most of an established active catalog.
    // Normal sparse daily absences proceed without an extra operator action.
    const previousActive = existing.filter(x => x.active).length;
    const largeHideThreshold = Math.max(150, Math.floor(previousActive * 0.40));
    const requiresLargeHideApproval = slot === "INITIAL_05" && previousActive >= 300
      && plan.hide.length > largeHideThreshold;
    const summary = { created:plan.create.length,updated:plan.update.length,
      activated:plan.activate.length,hidden:plan.hide.length,unchanged:plan.unchanged,
      previous_active:previousActive,requires_large_hide_approval:requiresLargeHideApproval,
      conflicts:plan.conflicts };
    if (action === "preview") return response({ status: "PREVIEW", ...summary });
    if (plan.conflicts.length && body.approve_conflicts !== true)
      return response({ error:"MANUAL_WEB_CONFLICT_APPROVAL_REQUIRED",...summary },409);
    if (requiresLargeHideApproval && body.approve_large_hide !== true)
      return response({ error:"FULL_ACTIVE_SET_DROP_REQUIRES_APPROVAL",...summary },409);
    if (Number(job.expected_revision || 0) !== Number(meta.revision || 0))
      return response({ error:"CATALOG_REVISION_CHANGED_REPREVIEW_REQUIRED" },409);
    if (slot !== "INITIAL_05" && String(meta.last_full_day || "") !== day)
      return response({ error: "INITIAL_FULL_NOT_PUBLISHED" }, 409);
    const at = new Date().toISOString();
    const committed = state.storage.transactionSync(() => {
      // Complete source is staged before any visible mutation. All changes publish together.
      // No WMS stock/bin quantities or browser authentication data are stored.
      const current = row(state,"SELECT state,generation,owner_id FROM d167_sku_jobs WHERE day_vn=? AND slot=?",day,slot);
      if (!current || current.state === "DONE" || current.generation !== generation || current.owner_id !== instance)
        return false;
      for (const x of staged) {
        const prior = existingBySku.get(x.sku);
        // rosterRows already read the entire current master in one SQL cursor.
        // Do not issue two more SQL row-reads for every unchanged item on
        // each daily FULL, nor write unchanged SKU metadata. The first FULL
        // still initializes a metadata row for every pre-existing SKU.
        if (prior?.has_active_record && !changedSkus.has(x.sku)) continue;
        const old = prior
          ? { product_name: prior.product_name }
          : null;
        if (!old) state.storage.sql.exec(
          "INSERT INTO sku_master (sku,product_name,source_hash,created_at,updated_at) VALUES (?,?,?,?,?)",
          x.sku,x.product_name,String(job.fingerprint),at,at);
        else if (old.product_name !== x.product_name &&
          (updates.get(x.sku)?.name !== undefined ||
           (body.approve_conflicts === true && plan.conflicts.some(c=>c.sku===x.sku&&c.field==="product_name"))))
          state.storage.sql.exec("UPDATE sku_master SET product_name=?,updated_at=? WHERE sku=?",x.product_name,at,x.sku);
        const prev = prior?.has_active_record
          ? { area: prior.area, area_verified: prior.area_verified ? 1 : 0,
              active: prior.active ? 1 : 0 }
          : null;
        const trustedUnknown = ["MULTIPLE_AREA","INVALID_PICKABLE_LOCATION"].includes(x.area_reason);
        const applyArea = (x.area_verified || trustedUnknown) && (!prev || updates.get(x.sku)?.area !== undefined ||
          (body.approve_conflicts === true && plan.conflicts.some(c=>c.sku===x.sku&&c.field==="area")));
        if (applyArea) auditArea(state,x,day,slot,at);
        if (!prev) state.storage.sql.exec(`INSERT INTO d167_sku_active
          (sku,active,area,area_verified,last_wms_name,last_wms_area,last_wms_observed_at)
          VALUES (?,?,?,?,?,?,?)`,x.sku,1,x.area,x.area_verified?1:0,x.product_name,x.area_verified?x.area:null,at);
        else {
          const effectiveArea = applyArea ? x.area : String(prev.area);
          const areaVerified = applyArea ? (x.area_verified?1:0) : Number(prev.area_verified);
          const nameChanged = !old || (old.product_name!==x.product_name &&
            (updates.get(x.sku)?.name !== undefined ||
             (body.approve_conflicts === true && plan.conflicts.some(c=>c.sku===x.sku&&c.field==="product_name"))));
          const needsUpdate = Number(prev.active)!==1 || prev.area!==effectiveArea ||
            Number(prev.area_verified)!==areaVerified || nameChanged;
          if (needsUpdate) state.storage.sql.exec(`UPDATE d167_sku_active
            SET active=1,area=?,area_verified=?,last_wms_name=?,last_wms_area=?,
            last_wms_observed_at=? WHERE sku=?`,
            effectiveArea,areaVerified,x.product_name,applyArea?x.area:prev.area,at,x.sku);
        }
      }
      if (slot==="INITIAL_05") {
        // The pre-D167 master may have historical SKUs with NO d167_sku_active
        // metadata row. Merely UPDATE-ing active=1 cannot hide those SKUs.
        // One set-based INSERT records them inactive on the FIRST valid FULL
        // without deleting sku_master, reports, histories or any tickets.
        state.storage.sql.exec(`INSERT OR IGNORE INTO d167_sku_active
          (sku,active,area,area_verified)
          SELECT s.sku,0,'UNKNOWN',0 FROM sku_master s
          WHERE NOT EXISTS(
            SELECT 1 FROM d167_sku_stage st
            WHERE st.day_vn=? AND st.slot=? AND st.sku=s.sku
          )`,day,slot);
        // Later FULL snapshots touch only membership changes; DELTA never hides.
        state.storage.sql.exec(`UPDATE d167_sku_active SET active=0
          WHERE active=1 AND NOT EXISTS(
            SELECT 1 FROM d167_sku_stage st
            WHERE st.day_vn=? AND st.slot=? AND st.sku=d167_sku_active.sku
          )`,day,slot);
      }
      // Entire staged manifest must be materialized in the active catalog
      // before publishing DONE. This SQL readback occurs inside the same atomic
      // transaction, so failures roll back all catalog and history mutations.
      const bad = row(state,`SELECT COUNT(*) AS n FROM d167_sku_stage st
        LEFT JOIN sku_master s ON s.sku=st.sku
        LEFT JOIN d167_sku_active a ON a.sku=st.sku
        WHERE st.day_vn=? AND st.slot=?
          AND (s.sku IS NULL OR a.sku IS NULL OR a.active!=1)`,day,slot);
      if (Number(bad?.n || 0)>0) throw new Error("D167_FULL_MANIFEST_READBACK_MISMATCH");
      if (slot==="INITIAL_05") {
        const unexpected = row(state,`SELECT COUNT(*) AS n FROM d167_sku_active a
          WHERE a.active=1 AND NOT EXISTS(
            SELECT 1 FROM d167_sku_stage st WHERE st.day_vn=? AND st.slot=? AND st.sku=a.sku
          )`,day,slot);
        if (Number(unexpected?.n||0)>0) throw new Error("D167_FULL_ACTIVE_SET_READBACK_MISMATCH");
      }
      const receipt = JSON.stringify({ day_vn:day,slot, fingerprint:job.fingerprint,
        source_rows:entries.length,...summary, completed_at:at });
      state.storage.sql.exec(`UPDATE d167_sku_jobs SET state='DONE',complete_at=?,receipt_json=?,
        lease_until_ms=0,updated_at=? WHERE day_vn=? AND slot=?`,at,receipt,at,day,slot);
      if (slot==="INITIAL_05") state.storage.sql.exec(
        "UPDATE d167_sku_meta SET last_full_day=?,revision=revision+1,published_at=? WHERE id=1",day,at);
      else if (summary.created+summary.updated+summary.activated>0)
        state.storage.sql.exec("UPDATE d167_sku_meta SET revision=revision+1,published_at=? WHERE id=1",at);
      // Cache item_count tracks the canonical master; hidden rows remain historical.
      state.storage.sql.exec(`INSERT OR IGNORE INTO sku_catalog_meta (id,item_count,max_updated_at)
        SELECT 1,COUNT(*),MAX(updated_at) FROM sku_master`);
      const nameModified = plan.create.length > 0 || plan.update.some(item => item.name !== undefined)
        || (body.approve_conflicts === true && plan.conflicts.some(c => c.field === "product_name"));
      const membershipModified = plan.hide.length > 0 || plan.activate.length > 0 ||
        plan.create.length > 0;
      // Android delta cannot express catalog removals. Record one monotonic
      // server-side membership epoch so old Android builds fall back to an
      // authoritative full refresh rather than accepting a stale local set.
      if (membershipModified) state.storage.sql.exec(
        "UPDATE d167_sku_meta SET membership_changed_at=? WHERE id=1",at);
      // Android catalog-info version must change on membership changes even when
      // sku_master name/updated_at stays intact; no-op and area-only jobs do not
      // unnecessarily wake every PDA catalog consumer.
      state.storage.sql.exec(`UPDATE sku_catalog_meta
        SET item_count=(SELECT COUNT(*) FROM sku_master),
            max_updated_at=CASE WHEN ? THEN ? ELSE COALESCE((SELECT MAX(updated_at) FROM sku_master),max_updated_at) END
        WHERE id=1`,nameModified || membershipModified ? 1 : 0,at);
      return true;
    });
    if (!committed) return response({ error:"HA_FENCED" },409);
    return response({ status:"DONE",...summary,day_vn:day,slot });
  }
  return response({ error:"NOT_FOUND" },404);
}

import { writeFile } from "node:fs/promises";
import { randomInt, randomUUID } from "node:crypto";

const BASE_URL = String(process.env.BASE_URL || "https://inventory-beta.supra.cc.cd").replace(/\/$/, "");
const LOAD_TEST_TOKEN = String(process.env.LOAD_TEST_TOKEN || "");
const REPORT_TARGET = Number(process.env.REPORTS || 1000);
const PICKER_TARGET = Number(process.env.PICKERS || 100);
const SKU_TARGET = Number(process.env.SKUS || 400);
const DURATION_SECONDS = Number(process.env.DURATION_SECONDS || 600);
const MAX_CONCURRENCY = Math.max(1, Math.min(12, Number(process.env.CONCURRENCY || 6)));
const TRAFFIC_WINDOW_MS = Math.max(60_000, Math.min(DURATION_SECONDS * 1000 - 75_000, 525_000));
const TEST_DEADLINE_MS = DURATION_SECONDS * 1000;
const SESSION_CONCURRENCY = 5;

if (!LOAD_TEST_TOKEN) throw new Error("LOAD_TEST_TOKEN is required.");
if (!Number.isInteger(REPORT_TARGET) || REPORT_TARGET < 1 || REPORT_TARGET > 5000) throw new Error("REPORTS out of range.");
if (!Number.isInteger(PICKER_TARGET) || PICKER_TARGET < 1 || PICKER_TARGET > 200) throw new Error("PICKERS out of range.");
if (!Number.isInteger(SKU_TARGET) || SKU_TARGET < 1 || SKU_TARGET > 1000) throw new Error("SKUS out of range.");
if (DURATION_SECONDS < 120 || DURATION_SECONDS > 900) throw new Error("DURATION_SECONDS out of range.");
if (REPORT_TARGET < SKU_TARGET) throw new Error("REPORTS must be >= SKUS so each selected SKU can be exercised.");

const headers = {
  "accept": "application/json",
  "x-load-test-token": LOAD_TEST_TOKEN,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
const nowIso = () => new Date().toISOString();
const safeJson = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 500) }; }
};

async function loadApi(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const body = await safeJson(response);
  if (!response.ok) {
    const error = new Error(`${path} HTTP ${response.status}: ${body.error || body.message || "request_failed"}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function prepare() {
  return loadApi(`/api/__beta_load_test__/prepare?pickers=${PICKER_TARGET}&skus=${SKU_TARGET}`);
}

async function createSession(userId) {
  return loadApi("/api/__beta_load_test__/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
}

async function snapshot() {
  return loadApi("/api/__beta_load_test__/snapshot");
}

async function recordResult(result) {
  return loadApi("/api/__beta_load_test__/record", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(result),
  });
}

function shuffledIndexes(length) {
  const indexes = Array.from({ length }, (_, index) => index);
  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return indexes;
}

async function mapConcurrent(items, concurrency, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return output;
}

function get(obj, path, fallback = 0) {
  let current = obj;
  for (const key of path) {
    if (!current || typeof current !== "object") return fallback;
    current = current[key];
  }
  return current == null ? fallback : current;
}

function compactSnapshot(snap) {
  const core = snap?.core || {};
  const sqlite = core.sqlite || {};
  const tables = sqlite.table_rows || {};
  const business = core.business || {};
  const realtime = core.realtime || {};
  const notifications = core.notifications || {};
  const drive = snap?.providers?.google_drive || {};
  const driveQuota = drive.storage_quota || {};
  return {
    generated_at: snap?.generated_at || null,
    sqlite_bytes: Number(sqlite.database_size_bytes || 0),
    rows: {
      report_batches: Number(tables.report_batches || 0),
      report_tickets: Number(tables.report_tickets || 0),
      report_events: Number(tables.report_events || 0),
      realtime_events: Number(tables.realtime_events || 0),
      result_acknowledgements: Number(tables.result_acknowledgements || 0),
      notification_delivery_attempts: Number(tables.notification_delivery_attempts || 0),
      audit_log: Number(tables.audit_log || 0),
    },
    reports_last_10_minutes: Number(business.reports_last_10_minutes || 0),
    realtime_latest_seq: Number(realtime.max_seq || 0),
    online_users: Number(realtime.online_users || 0),
    active_fcm_devices: Number(notifications.active_devices || 0),
    drive_usage_bytes: driveQuota.usage_bytes == null ? null : Number(driveQuota.usage_bytes),
  };
}

function delta(after, before) {
  if (after == null || before == null) return null;
  const a = Number(after);
  const b = Number(before);
  return Number.isFinite(a) && Number.isFinite(b) ? a - b : null;
}

function snapshotDelta(before, after) {
  const out = {
    sqlite_bytes: delta(after.sqlite_bytes, before.sqlite_bytes),
    rows: {},
    realtime_latest_seq: delta(after.realtime_latest_seq, before.realtime_latest_seq),
    drive_usage_bytes: delta(after.drive_usage_bytes, before.drive_usage_bytes),
  };
  for (const key of Object.keys(after.rows || {})) out.rows[key] = delta(after.rows[key], before.rows?.[key]);
  return out;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function randomChoice(items) {
  return items[randomInt(items.length)];
}

const testId = `d064-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
const startedAt = nowIso();
const startedMono = performance.now();
console.log(`Starting Beta load test ${testId}: target=${REPORT_TARGET}, pickers=${PICKER_TARGET}, skus=${SKU_TARGET}, traffic_window=${Math.round(TRAFFIC_WINDOW_MS/1000)}s, deadline=${DURATION_SECONDS}s`);

const candidates = await prepare();
const pickers = Array.isArray(candidates.pickers) ? candidates.pickers.slice(0, PICKER_TARGET) : [];
const skus = Array.isArray(candidates.skus) ? candidates.skus.slice(0, SKU_TARGET) : [];
if (pickers.length < PICKER_TARGET) throw new Error(`Only ${pickers.length}/${PICKER_TARGET} active Picker candidates available.`);
if (skus.length < SKU_TARGET) throw new Error(`Only ${skus.length}/${SKU_TARGET} SKU candidates available.`);

console.log(`Preparing authenticated sessions for ${pickers.length} existing Pickers...`);
const sessionRows = await mapConcurrent(pickers, SESSION_CONCURRENCY, async (picker, index) => {
  const session = await createSession(String(picker.user_id || ""));
  if (!session.id_token) throw new Error(`Picker session ${index + 1} missing id_token`);
  if ((index + 1) % 20 === 0) console.log(`Authenticated ${index + 1}/${pickers.length} Picker sessions`);
  return {
    userId: String(session.user?.user_id || picker.user_id || ""),
    employeeCode: String(session.user?.employee_code || picker.employee_code || ""),
    token: String(session.id_token),
  };
});

const sessionByUser = new Map(sessionRows.map((row) => [row.userId, row]));
const beforeFull = await snapshot();
const before = compactSnapshot(beforeFull);

const pairReservations = new Set();
function reservePair(preferredSku = null, preferredPickerIndex = null) {
  const sku = preferredSku || randomChoice(skus);
  const skuValue = String(sku.sku || "");
  const start = preferredPickerIndex == null ? randomInt(pickers.length) : preferredPickerIndex;
  for (let offset = 0; offset < pickers.length; offset += 1) {
    const index = (start + offset) % pickers.length;
    const picker = pickers[index];
    const key = `${picker.user_id}\u0000${skuValue}`;
    if (pairReservations.has(key)) continue;
    pairReservations.add(key);
    return { pickerIndex: index, sku: skuValue, pairKey: key };
  }
  return null;
}

const jobs = [];
for (const sku of skus) {
  const reserved = reservePair(sku, randomInt(pickers.length));
  if (!reserved) throw new Error(`Could not reserve Picker pair for SKU ${sku.sku}`);
  jobs.push({ ...reserved, requiredSku: true, targetMs: randomInt(Math.max(1, TRAFFIC_WINDOW_MS)) });
}
while (jobs.length < REPORT_TARGET) {
  const reserved = reservePair();
  if (!reserved) throw new Error("Ran out of unique Picker + SKU pairs.");
  jobs.push({ ...reserved, requiredSku: false, targetMs: randomInt(Math.max(1, TRAFFIC_WINDOW_MS)) });
}
jobs.sort((a, b) => a.targetMs - b.targetMs);

const latencies = [];
const statusCounts = {};
const errorCounts = {};
const successfulSkus = new Set();
const completedPairs = new Set();
let successes = 0;
let failures = 0;

function bump(target, key) {
  target[key] = Number(target[key] || 0) + 1;
}

async function refreshPickerToken(pickerIndex) {
  const picker = pickers[pickerIndex];
  const session = await createSession(String(picker.user_id || ""));
  const row = {
    userId: String(session.user?.user_id || picker.user_id || ""),
    employeeCode: String(session.user?.employee_code || picker.employee_code || ""),
    token: String(session.id_token || ""),
  };
  if (!row.token) throw new Error("Refreshed Picker session missing token.");
  sessionByUser.set(row.userId, row);
  return row;
}

async function chooseAlternatePair(job, preserveSku = true) {
  const preferred = preserveSku ? skus.find((item) => String(item.sku || "") === job.sku) : null;
  const next = reservePair(preferred || null, randomInt(pickers.length));
  if (!next && preserveSku) return chooseAlternatePair(job, false);
  return next;
}

async function submitJob(originalJob) {
  let job = { ...originalJob };
  let requestId = randomUUID();
  let retry = 0;

  while (performance.now() - startedMono < TEST_DEADLINE_MS - 5_000) {
    const picker = pickers[job.pickerIndex];
    let session = sessionByUser.get(String(picker.user_id || ""));
    if (!session) session = await refreshPickerToken(job.pickerIndex);

    const started = performance.now();
    let response;
    let payload = {};
    try {
      response = await fetch(`${BASE_URL}/api/picker/reports`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${session.token}`,
          "user-agent": "supra-inventory-beta-d064-load-test",
        },
        body: JSON.stringify({ request_id: requestId, sku: job.sku }),
      });
      payload = await safeJson(response);
    } catch (error) {
      bump(errorCounts, "NETWORK_ERROR");
      retry += 1;
      await sleep(Math.min(2000, 120 * 2 ** Math.min(retry, 4)) + randomInt(150));
      continue;
    }
    const elapsed = performance.now() - started;
    latencies.push(elapsed);
    bump(statusCounts, String(response.status));

    if (response.ok) {
      successes += 1;
      completedPairs.add(job.pairKey);
      successfulSkus.add(job.sku);
      return true;
    }

    const code = String(payload.error || `HTTP_${response.status}`);
    bump(errorCounts, code);

    if (response.status === 409 && code === "ALREADY_REPORTED") {
      const replacement = await chooseAlternatePair(job, true);
      if (!replacement) break;
      job = { ...job, ...replacement };
      requestId = randomUUID();
      retry = 0;
      continue;
    }

    if (response.status === 401 && retry < 2) {
      await refreshPickerToken(job.pickerIndex);
      retry += 1;
      continue;
    }

    if ((response.status === 429 || response.status >= 500) && retry < 5) {
      retry += 1;
      await sleep(Math.min(3000, 150 * 2 ** retry) + randomInt(250));
      continue;
    }

    break;
  }

  failures += 1;
  return false;
}

const inflight = new Set();
for (let index = 0; index < jobs.length; index += 1) {
  const job = jobs[index];
  const targetAt = startedMono + job.targetMs;
  const waitMs = targetAt - performance.now();
  if (waitMs > 0) await sleep(waitMs);

  while (inflight.size >= MAX_CONCURRENCY) await Promise.race(inflight);
  const promise = submitJob(job).finally(() => inflight.delete(promise));
  inflight.add(promise);

  if ((index + 1) % 100 === 0) console.log(`Scheduled ${index + 1}/${jobs.length}; success so far=${successes}`);
}
await Promise.all(inflight);

// Recovery phase: ensure every selected SKU occurred at least once, then fill total successes.
const missingSkuObjects = skus.filter((item) => !successfulSkus.has(String(item.sku || "")));
for (const sku of missingSkuObjects) {
  if (performance.now() - startedMono >= TEST_DEADLINE_MS - 5_000) break;
  const replacement = reservePair(sku, randomInt(pickers.length));
  if (replacement) await submitJob({ ...replacement, requiredSku: true, targetMs: 0 });
}
while (successes < REPORT_TARGET && performance.now() - startedMono < TEST_DEADLINE_MS - 5_000) {
  const replacement = reservePair();
  if (!replacement) break;
  await submitJob({ ...replacement, requiredSku: false, targetMs: 0 });
}

const afterFull = await snapshot();
const after = compactSnapshot(afterFull);
const completedAt = nowIso();
const durationSeconds = (performance.now() - startedMono) / 1000;
const latencySum = latencies.reduce((sum, value) => sum + value, 0);

const result = {
  test_id: testId,
  started_at: startedAt,
  completed_at: completedAt,
  duration_seconds: Number(durationSeconds.toFixed(3)),
  requested_reports: REPORT_TARGET,
  successful_reports: successes,
  failed_reports: failures,
  picker_count: pickers.length,
  sku_count: skus.length,
  unique_skus_reported: successfulSkus.size,
  average_ms: Number((latencies.length ? latencySum / latencies.length : 0).toFixed(2)),
  p50_ms: Number(percentile(latencies, 0.50).toFixed(2)),
  p95_ms: Number(percentile(latencies, 0.95).toFixed(2)),
  max_ms: Number((latencies.length ? Math.max(...latencies) : 0).toFixed(2)),
  http_status_counts: statusCounts,
  error_counts: errorCounts,
  before,
  after,
  delta: snapshotDelta(before, after),
};

await recordResult(result);
await writeFile("load-test-result.json", JSON.stringify(result, null, 2) + "\n", "utf8");

console.log(JSON.stringify({
  test_id: result.test_id,
  duration_seconds: result.duration_seconds,
  successful_reports: result.successful_reports,
  requested_reports: result.requested_reports,
  picker_count: result.picker_count,
  unique_skus_reported: result.unique_skus_reported,
  average_ms: result.average_ms,
  p50_ms: result.p50_ms,
  p95_ms: result.p95_ms,
  max_ms: result.max_ms,
  delta: result.delta,
  errors: result.error_counts,
}, null, 2));

if (successes !== REPORT_TARGET) {
  throw new Error(`Load test did not reach target: ${successes}/${REPORT_TARGET} successful reports in ${durationSeconds.toFixed(1)} seconds.`);
}
if (successfulSkus.size < SKU_TARGET) {
  throw new Error(`Load test did not exercise all selected SKUs: ${successfulSkus.size}/${SKU_TARGET}.`);
}
if (durationSeconds > DURATION_SECONDS + 5) {
  throw new Error(`Load test exceeded requested duration: ${durationSeconds.toFixed(1)}s > ${DURATION_SECONDS}s.`);
}
console.log("D064_BETA_LOAD_TEST_PASS");

import { getServiceAccountAccessToken } from "./hr-source";
import { closedBusinessDayKey } from "./relay-audit";

export interface RelayUsageEnv {
  FIREBASE_PROJECT_ID: string;
  GOOGLE_RUNTIME_SA_JSON?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?: string;
}

type MetricPoint = {
  interval?: { endTime?: string };
  value?: { int64Value?: string; doubleValue?: number };
};

type TimeSeries = {
  metric?: { labels?: Record<string, string> };
  points?: MetricPoint[];
};

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
};

type FirestoreDoc = {
  fields?: Record<string, FirestoreValue>;
};

const MONITORING_SCOPE = "https://www.googleapis.com/auth/monitoring.read";
const FIRESTORE_READ = "firestore.googleapis.com/document/read_ops_count";
const FIRESTORE_WRITE = "firestore.googleapis.com/document/write_ops_count";
const FIRESTORE_DELETE = "firestore.googleapis.com/document/delete_ops_count";
const FIRESTORE_STORAGE = "firestore.googleapis.com/storage/data_and_index_storage_bytes";
const FIRESTORE_CONNECTIONS = "firestore.googleapis.com/network/active_connections";
const FIRESTORE_LISTENERS = "firestore.googleapis.com/network/snapshot_listeners";
const AUTH_DAILY = "identitytoolkit.googleapis.com/usage/daily_new_signin_count";
const AUTH_MONTHLY = "identitytoolkit.googleapis.com/usage/monthly_new_signin_count";
const FUNCTION_EXECUTIONS = "cloudfunctions.googleapis.com/function/execution_count";

let providerCache: { at: number; value: unknown } | null = null;
let driveCache: { at: number; value: { usage: number; limit: number; usageInDrive: number } | null } | null = null;

function pointNumber(point: MetricPoint | undefined): number {
  const raw = point?.value?.int64Value;
  if (raw != null) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const value = Number(point?.value?.doubleValue || 0);
  return Number.isFinite(value) ? value : 0;
}

function sumSeries(series: TimeSeries[]): number {
  let total = 0;
  for (const row of series) for (const point of row.points || []) total += pointNumber(point);
  return total;
}

function latestSeriesSum(series: TimeSeries[]): number {
  let total = 0;
  for (const row of series) {
    const points = [...(row.points || [])].sort((a, b) =>
      String(b.interval?.endTime || "").localeCompare(String(a.interval?.endTime || "")));
    total += pointNumber(points[0]);
  }
  return total;
}

function zoneParts(now: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function zonedMidnightUtc(now: Date, timeZone: string): Date {
  const p = zoneParts(now, timeZone);
  const desired = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0);
  let guess = desired;
  for (let i = 0; i < 3; i += 1) {
    const g = zoneParts(new Date(guess), timeZone);
    const represented = Date.UTC(g.year, g.month - 1, g.day, g.hour % 24, g.minute, 0);
    guess += desired - represented;
  }
  return new Date(guess);
}

function monthStartUtc(now: Date): Date {
  const p = zoneParts(now, "Asia/Ho_Chi_Minh");
  return new Date(Date.UTC(p.year, p.month - 1, 1, 0, 0, 0) - 7 * 60 * 60 * 1000);
}

async function monitoringToken(env: RelayUsageEnv): Promise<string> {
  if (!env.GOOGLE_RUNTIME_SA_JSON) throw new Error("GOOGLE_RUNTIME_NOT_CONFIGURED");
  return (await getServiceAccountAccessToken(env.GOOGLE_RUNTIME_SA_JSON, MONITORING_SCOPE)).accessToken;
}

async function metricSeries(
  env: RelayUsageEnv,
  token: string,
  metricType: string,
  start: Date,
  end: Date,
): Promise<TimeSeries[]> {
  const url = new URL(
    `https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/timeSeries`,
  );
  url.searchParams.set("filter", `metric.type="${metricType}"`);
  url.searchParams.set("interval.startTime", start.toISOString());
  url.searchParams.set("interval.endTime", end.toISOString());
  url.searchParams.set("view", "FULL");
  url.searchParams.set("pageSize", "1000");
  const response = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`MONITORING_${response.status}`);
  const payload = await response.json() as { timeSeries?: TimeSeries[] };
  return payload.timeSeries || [];
}

function fsString(fields: Record<string, FirestoreValue> | undefined, key: string): string {
  return String(fields?.[key]?.stringValue || "");
}

function fsLong(fields: Record<string, FirestoreValue> | undefined, key: string): number {
  const value = Number(fields?.[key]?.integerValue || 0);
  return Number.isFinite(value) ? value : 0;
}

async function exportState(env: RelayUsageEnv, token: string): Promise<Record<string, unknown>> {
  const day = closedBusinessDayKey();
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/relay_poc_coordination/audit_export_${day}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (response.status === 404) return { business_day: day, status: "PENDING", rows: 0 };
  if (!response.ok) return { business_day: day, status: "UNAVAILABLE", error: `HTTP_${response.status}` };
  const doc = await response.json() as FirestoreDoc;
  return {
    business_day: day,
    status: fsString(doc.fields, "status") || "PENDING",
    file_name: fsString(doc.fields, "file_name"),
    rows: fsLong(doc.fields, "row_count"),
    duration_ms: fsLong(doc.fields, "duration_ms"),
    deleted_jobs: fsLong(doc.fields, "deleted_jobs"),
    deleted_guards: fsLong(doc.fields, "deleted_guards"),
    updated_at_ms: fsLong(doc.fields, "updated_at_ms"),
    error_code: fsString(doc.fields, "error_code"),
  };
}

async function driveAccessToken(env: RelayUsageEnv): Promise<string> {
  if (!env.GOOGLE_DRIVE_OAUTH_CLIENT_ID ||
      !env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET ||
      !env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN) throw new Error("DRIVE_OAUTH_NOT_CONFIGURED");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_DRIVE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET,
      refresh_token: env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const payload = await response.json() as { access_token?: string };
  if (!response.ok || !payload.access_token) throw new Error(`DRIVE_OAUTH_${response.status}`);
  return payload.access_token;
}

async function driveStorage(env: RelayUsageEnv): Promise<{ usage: number; limit: number; usageInDrive: number } | null> {
  const now = Date.now();
  if (driveCache && now - driveCache.at < 6 * 60 * 60 * 1000) return driveCache.value;
  try {
    const token = await driveAccessToken(env);
    const response = await fetch(
      "https://www.googleapis.com/drive/v3/about?fields=storageQuota(limit%2Cusage%2CusageInDrive)",
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error(`DRIVE_ABOUT_${response.status}`);
    const payload = await response.json() as {
      storageQuota?: { limit?: string; usage?: string; usageInDrive?: string };
    };
    const value = {
      usage: Number(payload.storageQuota?.usage || 0),
      limit: Number(payload.storageQuota?.limit || 0),
      usageInDrive: Number(payload.storageQuota?.usageInDrive || 0),
    };
    driveCache = { at: now, value };
    return value;
  } catch {
    driveCache = { at: now, value: null };
    return null;
  }
}

export async function collectRelayUsage(env: RelayUsageEnv, force = false): Promise<Record<string, unknown>> {
  const nowMs = Date.now();
  if (!force && providerCache && nowMs - providerCache.at < 10 * 60 * 1000) {
    return { ...(providerCache.value as Record<string, unknown>), cached: true };
  }

  const now = new Date();
  let monitoring: Record<string, unknown>;
  let firestoreToken = "";
  try {
    const token = await monitoringToken(env);
    const providerDayStart = zonedMidnightUtc(now, "America/Los_Angeles");
    const monthStart = monthStartUtc(now);
    const recentStart = new Date(now.getTime() - 30 * 60 * 1000);

    const [
      readsSeries,
      writesSeries,
      deletesSeries,
      storageSeries,
      connectionsSeries,
      listenersSeries,
      dailyAuthSeries,
      monthlyAuthSeries,
      functionSeries,
    ] = await Promise.all([
      metricSeries(env, token, FIRESTORE_READ, providerDayStart, now),
      metricSeries(env, token, FIRESTORE_WRITE, providerDayStart, now),
      metricSeries(env, token, FIRESTORE_DELETE, providerDayStart, now),
      metricSeries(env, token, FIRESTORE_STORAGE, recentStart, now),
      metricSeries(env, token, FIRESTORE_CONNECTIONS, recentStart, now),
      metricSeries(env, token, FIRESTORE_LISTENERS, recentStart, now),
      metricSeries(env, token, AUTH_DAILY, providerDayStart, now),
      metricSeries(env, token, AUTH_MONTHLY, monthStart, now),
      metricSeries(env, token, FUNCTION_EXECUTIONS, providerDayStart, now),
    ]);

    const functionExecutions = sumSeries(functionSeries);
    const functionErrors = sumSeries(functionSeries.filter((row) =>
      String(row.metric?.labels?.status || "").toLowerCase() !== "ok"));

    monitoring = {
      available: true,
      provider_day: providerDayStart.toISOString(),
      firestore: {
        reads: Math.round(sumSeries(readsSeries)),
        writes: Math.round(sumSeries(writesSeries)),
        deletes: Math.round(sumSeries(deletesSeries)),
        storage_bytes: Math.round(latestSeriesSum(storageSeries)),
        active_connections: Math.round(latestSeriesSum(connectionsSeries)),
        snapshot_listeners: Math.round(latestSeriesSum(listenersSeries)),
        soft: { reads: 42000, writes: 15000, deletes: 3000, storage_bytes: 805306368 },
        free_reference: { reads: 50000, writes: 20000, deletes: 20000, storage_bytes: 1073741824 },
      },
      auth: {
        daily_active: Math.round(sumSeries(dailyAuthSeries)),
        monthly_active: Math.round(sumSeries(monthlyAuthSeries)),
      },
      functions: {
        executions: Math.round(functionExecutions),
        errors: Math.round(functionErrors),
      },
      fcm: { pricing: "NO_COST" },
    };
  } catch (error) {
    monitoring = {
      available: false,
      error: error instanceof Error ? error.message.slice(0, 120) : "MONITORING_UNAVAILABLE",
    };
  }

  try {
    if (!env.GOOGLE_RUNTIME_SA_JSON) throw new Error("GOOGLE_RUNTIME_NOT_CONFIGURED");
    firestoreToken = (await getServiceAccountAccessToken(env.GOOGLE_RUNTIME_SA_JSON, "https://www.googleapis.com/auth/datastore")).accessToken;
  } catch {
    firestoreToken = "";
  }

  const result: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    cache_ttl_seconds: 600,
    scope: "PDA_AGENT_AND_DAILY_EXPORT_ONLY",
    monitoring,
    drive: await driveStorage(env),
    export: firestoreToken ? await exportState(env, firestoreToken) : { status: "UNAVAILABLE" },
    cached: false,
  };
  providerCache = { at: nowMs, value: result };
  return result;
}

export interface AndroidAlertWindowState {
  start_minutes: number;
  end_minutes: number;
  overtime_until_ms: number | null;
  is_open: boolean;
  normal_window_open: boolean;
  overtime_open: boolean;
  server_now: string;
  server_now_ms: number;
  business_date: string;
  closes_at_ms: number | null;
  updated_at: string | null;
  updated_by: string | null;
}

const CONFIG_KEY = "d119_android_alert_window";
const START_MINUTES = 5 * 60;
const END_MINUTES = 23 * 60;
const HOUR_MS = 60 * 60_000;

type ConfigRow = {
  value_json: string;
  updated_at: string;
  updated_by: string | null;
};

type StoredConfig = {
  overtime_until_ms?: unknown;
};

function vietnamParts(nowMs: number): {
  date: string;
  minutes: number;
  dayStartUtcMs: number;
} {
  const shifted = new Date(nowMs + 7 * HOUR_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  return {
    date: `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    dayStartUtcMs: Date.UTC(year, month, day) - 7 * HOUR_MS,
  };
}

function storedConfig(state: DurableObjectState): { overtimeUntilMs: number | null; updatedAt: string | null; updatedBy: string | null } {
  const row = state.storage.sql.exec<ConfigRow>(
    "SELECT value_json, updated_at, updated_by FROM app_config WHERE key = ? LIMIT 1",
    CONFIG_KEY,
  ).toArray()[0];
  if (!row) return { overtimeUntilMs: null, updatedAt: null, updatedBy: null };
  try {
    const parsed = JSON.parse(row.value_json) as StoredConfig;
    const value = Number(parsed.overtime_until_ms || 0);
    return {
      overtimeUntilMs: Number.isFinite(value) && value > 0 ? Math.trunc(value) : null,
      updatedAt: row.updated_at || null,
      updatedBy: row.updated_by || null,
    };
  } catch {
    return { overtimeUntilMs: null, updatedAt: row.updated_at || null, updatedBy: row.updated_by || null };
  }
}

export function readAndroidAlertWindow(
  state: DurableObjectState,
  nowMs = Date.now(),
): AndroidAlertWindowState {
  const parts = vietnamParts(nowMs);
  const stored = storedConfig(state);
  const activeOvertimeUntil = stored.overtimeUntilMs != null && stored.overtimeUntilMs > nowMs
    ? stored.overtimeUntilMs
    : null;
  const normalOpen = parts.minutes >= START_MINUTES && parts.minutes < END_MINUTES;
  const overtimeOpen = !normalOpen && activeOvertimeUntil != null;
  const standardClose = parts.dayStartUtcMs + END_MINUTES * 60_000;
  const normalClose = normalOpen ? standardClose : null;
  const overtimeClose = overtimeOpen ? activeOvertimeUntil : null;
  return {
    start_minutes: START_MINUTES,
    end_minutes: END_MINUTES,
    overtime_until_ms: activeOvertimeUntil,
    is_open: normalOpen || overtimeOpen,
    normal_window_open: normalOpen,
    overtime_open: overtimeOpen,
    server_now: new Date(nowMs).toISOString(),
    server_now_ms: nowMs,
    business_date: parts.date,
    closes_at_ms: overtimeClose ?? normalClose,
    updated_at: stored.updatedAt,
    updated_by: stored.updatedBy,
  };
}

export function updateAndroidAlertWindow(
  state: DurableObjectState,
  actorUserId: string,
  action: "EXTEND_ONE_HOUR" | "STOP_OVERTIME",
  nowMs = Date.now(),
): AndroidAlertWindowState {
  const current = readAndroidAlertWindow(state, nowMs);
  const parts = vietnamParts(nowMs);
  let overtimeUntilMs: number | null = null;

  if (action === "EXTEND_ONE_HOUR") {
    const standardCloseMs = parts.dayStartUtcMs + END_MINUTES * 60_000;
    const existing = current.overtime_until_ms && current.overtime_until_ms > nowMs
      ? current.overtime_until_ms
      : 0;
    const base = existing > 0
      ? existing
      : current.normal_window_open
        ? standardCloseMs
        : nowMs;
    overtimeUntilMs = base + HOUR_MS;
    if (overtimeUntilMs <= nowMs) throw new Error("ALERT_OVERTIME_WINDOW_ENDED");
  }

  state.storage.sql.exec(
    `INSERT INTO app_config (key, value_json, updated_at, updated_by)
     VALUES (?, ?, CURRENT_TIMESTAMP, ?)
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = CURRENT_TIMESTAMP,
       updated_by = excluded.updated_by`,
    CONFIG_KEY,
    JSON.stringify({ overtime_until_ms: overtimeUntilMs }),
    actorUserId || null,
  );
  return readAndroidAlertWindow(state, nowMs);
}

export interface AndroidAlertWindowState {
  start_minutes: number;
  end_minutes: number;
  overtime_cutoff_minutes: number;
  schedule_key: string;
  schedule_version: number;
  decision: string | null;
  overtime_until_ms: number | null;
  is_open: boolean;
  normal_window_open: boolean;
  overtime_open: boolean;
  early_start_open: boolean;
  server_now: string;
  server_now_ms: number;
  business_date: string;
  closes_at_ms: number | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface OperatingScheduleMirrorInput {
  schedule_key?: unknown;
  version?: unknown;
  decision?: unknown;
  decision_boundary_ms?: unknown;
  open_until_ms?: unknown;
  updated_at_ms?: unknown;
  updated_by_agent_instance_id?: unknown;
}

const CONFIG_KEY = "d149_operating_schedule";
const START_MINUTES = 6 * 60;
const END_MINUTES = 22 * 60;
const OVERTIME_CUTOFF_MINUTES = 5 * 60;
const HOUR_MS = 60 * 60_000;

type ConfigRow = {
  value_json: string;
  updated_at: string;
  updated_by: string | null;
};

type StoredConfig = {
  schedule_key?: unknown;
  version?: unknown;
  decision?: unknown;
  decision_boundary_ms?: unknown;
  open_until_ms?: unknown;
  updated_at_ms?: unknown;
  updated_by_agent_instance_id?: unknown;
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

function compactDate(dayStartUtcMs: number): string {
  const shifted = new Date(dayStartUtcMs + 7 * HOUR_MS);
  return `${shifted.getUTCFullYear()}${String(shifted.getUTCMonth() + 1).padStart(2, "0")}${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function scheduleKeyForNow(nowMs: number): string {
  const parts = vietnamParts(nowMs);
  const businessDayStart = parts.minutes < OVERTIME_CUTOFF_MINUTES
    ? parts.dayStartUtcMs - 24 * HOUR_MS
    : parts.dayStartUtcMs;
  return compactDate(businessDayStart);
}

function storedConfig(state: DurableObjectState): {
  scheduleKey: string;
  version: number;
  decision: string;
  decisionBoundaryMs: number;
  openUntilMs: number;
  updatedAtMs: number;
  updatedAt: string | null;
  updatedBy: string | null;
} {
  const row = state.storage.sql.exec<ConfigRow>(
    "SELECT value_json, updated_at, updated_by FROM app_config WHERE key = ? LIMIT 1",
    CONFIG_KEY,
  ).toArray()[0];
  if (!row) {
    return {
      scheduleKey: "", version: 0, decision: "", decisionBoundaryMs: 0,
      openUntilMs: 0, updatedAtMs: 0, updatedAt: null, updatedBy: null,
    };
  }
  try {
    const parsed = JSON.parse(row.value_json) as StoredConfig;
    return {
      scheduleKey: String(parsed.schedule_key || ""),
      version: Math.max(0, Math.trunc(Number(parsed.version || 0))),
      decision: String(parsed.decision || ""),
      decisionBoundaryMs: Math.max(0, Math.trunc(Number(parsed.decision_boundary_ms || 0))),
      openUntilMs: Math.max(0, Math.trunc(Number(parsed.open_until_ms || 0))),
      updatedAtMs: Math.max(0, Math.trunc(Number(parsed.updated_at_ms || 0))),
      updatedAt: row.updated_at || null,
      updatedBy: row.updated_by || null,
    };
  } catch {
    return {
      scheduleKey: "", version: 0, decision: "", decisionBoundaryMs: 0,
      openUntilMs: 0, updatedAtMs: 0, updatedAt: row.updated_at || null, updatedBy: row.updated_by || null,
    };
  }
}

function projectionApplies(nowMs: number, stored: ReturnType<typeof storedConfig>): boolean {
  return Boolean(
    stored.scheduleKey &&
    stored.scheduleKey === scheduleKeyForNow(nowMs) &&
    stored.openUntilMs > nowMs &&
    stored.version > 0
  );
}

export function readAndroidAlertWindow(
  state: DurableObjectState,
  nowMs = Date.now(),
): AndroidAlertWindowState {
  const parts = vietnamParts(nowMs);
  const stored = storedConfig(state);
  const currentKey = scheduleKeyForNow(nowMs);
  const normalOpen = parts.minutes >= START_MINUTES && parts.minutes < END_MINUTES;
  const projectedOpen = projectionApplies(nowMs, stored);
  const earlyStartOpen = projectedOpen &&
    parts.minutes >= OVERTIME_CUTOFF_MINUTES &&
    parts.minutes < START_MINUTES &&
    stored.decision === "EARLY_START";
  const overtimeOpen = projectedOpen &&
    (parts.minutes >= END_MINUTES || parts.minutes < OVERTIME_CUTOFF_MINUTES) &&
    stored.decision !== "EARLY_START";
  const standardClose = parts.dayStartUtcMs + END_MINUTES * 60_000;

  let closesAtMs: number | null = null;
  if (normalOpen) {
    closesAtMs = Math.max(standardClose, projectedOpen ? stored.openUntilMs : 0);
  } else if (earlyStartOpen) {
    // Early start joins the deterministic 06:00-22:00 window without a gap.
    closesAtMs = standardClose;
  } else if (overtimeOpen) {
    closesAtMs = stored.openUntilMs;
  }

  return {
    start_minutes: START_MINUTES,
    end_minutes: END_MINUTES,
    overtime_cutoff_minutes: OVERTIME_CUTOFF_MINUTES,
    schedule_key: currentKey,
    schedule_version: stored.scheduleKey === currentKey ? stored.version : 0,
    decision: stored.scheduleKey === currentKey && stored.decision ? stored.decision : null,
    overtime_until_ms: overtimeOpen ? stored.openUntilMs : null,
    is_open: normalOpen || earlyStartOpen || overtimeOpen,
    normal_window_open: normalOpen,
    overtime_open: overtimeOpen,
    early_start_open: earlyStartOpen,
    server_now: new Date(nowMs).toISOString(),
    server_now_ms: nowMs,
    business_date: parts.date,
    closes_at_ms: closesAtMs,
    updated_at: stored.updatedAt,
    updated_by: stored.updatedBy,
  };
}

export function mirrorAndroidOperatingSchedule(
  state: DurableObjectState,
  body: OperatingScheduleMirrorInput,
  nowMs = Date.now(),
): AndroidAlertWindowState {
  const scheduleKey = String(body.schedule_key || "").trim();
  const version = Math.max(0, Math.trunc(Number(body.version || 0)));
  const decision = String(body.decision || "").trim().toUpperCase();
  const decisionBoundaryMs = Math.max(0, Math.trunc(Number(body.decision_boundary_ms || 0)));
  const openUntilMs = Math.max(0, Math.trunc(Number(body.open_until_ms || 0)));
  const updatedAtMs = Math.max(0, Math.trunc(Number(body.updated_at_ms || 0)));
  const updatedBy = String(body.updated_by_agent_instance_id || "").trim().slice(0, 160);

  if (!/^\d{8}$/.test(scheduleKey) || version <= 0 || !["CONTINUE", "STOP", "MANUAL_ADJUST", "EARLY_START"].includes(decision)) {
    throw new Error("INVALID_OPERATING_SCHEDULE");
  }
  if (openUntilMs <= 0 || openUntilMs < decisionBoundaryMs) throw new Error("INVALID_OPERATING_SCHEDULE_WINDOW");

  const current = storedConfig(state);
  if (version <= current.version) return readAndroidAlertWindow(state, nowMs);

  state.storage.sql.exec(
    `INSERT INTO app_config (key, value_json, updated_at, updated_by)
     VALUES (?, ?, CURRENT_TIMESTAMP, ?)
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = CURRENT_TIMESTAMP,
       updated_by = excluded.updated_by`,
    CONFIG_KEY,
    JSON.stringify({
      schedule_key: scheduleKey,
      version,
      decision,
      decision_boundary_ms: decisionBoundaryMs,
      open_until_ms: openUntilMs,
      updated_at_ms: updatedAtMs || version,
      updated_by_agent_instance_id: updatedBy,
    }),
    updatedBy || "GOOGLE_RUNTIME_D149",
  );
  return readAndroidAlertWindow(state, nowMs);
}

export function updateAndroidAlertWindow(
  _state: DurableObjectState,
  _actorUserId: string,
  _action: "EXTEND_ONE_HOUR" | "STOP_OVERTIME",
  _nowMs = Date.now(),
): AndroidAlertWindowState {
  // D149: Web is no longer an independent schedule writer. Keeping this exported
  // function makes stale callers fail closed instead of silently splitting authority.
  throw new Error("ALERT_WINDOW_AGENT_AUTHORITY_D149");
}

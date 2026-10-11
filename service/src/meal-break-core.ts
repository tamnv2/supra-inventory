type SqlRow = Record<string, SqlStorageValue>;

const VN_OFFSET_MS = 7 * 60 * 60_000;
const DAY_MS = 86_400_000;
const MAX_DAYS = 30;
export type MealPeriod = "LUNCH" | "DINNER";
export type MealChoice = "EARLY" | "LATE";

export function vnDayAt(ms: number): string {
  return new Date(ms + VN_OFFSET_MS).toISOString().slice(0, 10);
}

export function vnMidnightMs(day: string): number {
  return Date.parse(day + "T00:00:00Z") - VN_OFFSET_MS;
}

function first<T extends SqlRow>(rows: T[]): T | null { return rows[0] || null; }

function slotFor(day: string, period: MealPeriod, choice: MealChoice | null): { from: number; to: number } {
  const base = vnMidnightMs(day);
  const start = period === "LUNCH" ? 11 : 18;
  const startMinutes = start * 60 + (choice !== "EARLY" ? 30 : 0);
  const endMinutes = startMinutes + 30;
  return { from: base + startMinutes * 60_000, to: base + endMinutes * 60_000 };
}

export function initializeMealSchema(state: DurableObjectState): void {
  state.storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS d167_meal_choices (
      day_vn TEXT NOT NULL,
      period TEXT NOT NULL CHECK(period IN ('LUNCH','DINNER')),
      choice TEXT NOT NULL CHECK(choice IN ('EARLY','LATE')),
      starts_at_ms INTEGER NOT NULL,
      ends_at_ms INTEGER NOT NULL,
      confirmed_at TEXT NOT NULL,
      confirmed_by TEXT NOT NULL,
      confirmed_name TEXT NOT NULL DEFAULT '',
      PRIMARY KEY(day_vn, period)
    );
    CREATE TABLE IF NOT EXISTS d167_meal_prompt_markers (
      day_vn TEXT NOT NULL,
      period TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY(day_vn, period)
    );
  `);
}

export function mealWindowsBetween(state: DurableObjectState, startMs: number, endMs: number): Array<{ from: number; to: number }> {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];
  const fromDay = vnDayAt(startMs - DAY_MS);
  const toDay = vnDayAt(endMs + DAY_MS);
  const stored = state.storage.sql.exec<SqlRow>(
    "SELECT day_vn, period, choice FROM d167_meal_choices WHERE day_vn >= ? AND day_vn <= ?",
    fromDay, toDay,
  ).toArray();
  const byKey = new Map(stored.map(r => [String(r.day_vn) + ":" + String(r.period), String(r.choice) as MealChoice]));
  const windows: Array<{ from: number; to: number }> = [];
  let dayMs = vnMidnightMs(fromDay);
  for (let i = 0; i < MAX_DAYS + 2 && dayMs <= vnMidnightMs(toDay); i++, dayMs += DAY_MS) {
    const day = vnDayAt(dayMs);
    for (const period of ["LUNCH", "DINNER"] as const) {
      const choice = byKey.get(day + ":" + period) || null;
      const slot = slotFor(day, period, choice);
      if (slot.to > startMs && slot.from < endMs) windows.push(slot);
    }
  }
  windows.sort((a, b) => a.from - b.from);
  return windows;
}

// A missing Reporter choice is fail-closed: the possible one-hour meal
// window pauses only AUTO-SKIP, never user actions or the separate correction timer.
export function mealAdjustedDeadline(state: DurableObjectState, baseAt: string, minutes: number): string | null {
  const base = Date.parse(baseAt);
  if (!Number.isFinite(base) || !Number.isInteger(minutes) || minutes < 1 || minutes > 10_080) return null;
  const windows = mealWindowsBetween(state, base, base + minutes * 60_000 + MAX_DAYS * DAY_MS);
  let remaining = minutes * 60_000;
  let cursor = base;
  for (const slot of windows) {
    if (slot.to <= cursor) continue;
    if (cursor < slot.from) {
      const usable = slot.from - cursor;
      if (remaining <= usable) return new Date(cursor + remaining).toISOString();
      remaining -= usable;
      cursor = slot.from;
    }
    if (slot.to > cursor) cursor = slot.to;
  }
  return new Date(cursor + remaining).toISOString();
}

export function getMealChoiceState(state: DurableObjectState, nowMs = Date.now()): Record<string, unknown> {
  const day = vnDayAt(nowMs);
  const base = vnMidnightMs(day);
  const selected = state.storage.sql.exec<SqlRow>(
    "SELECT period, choice, starts_at_ms, ends_at_ms, confirmed_at, confirmed_by, confirmed_name FROM d167_meal_choices WHERE day_vn = ?",
    day,
  ).toArray();
  const rows = Object.fromEntries(selected.map(x => [String(x.period), {
    choice: x.choice, start_ms: Number(x.starts_at_ms), end_ms: Number(x.ends_at_ms),
    confirmed_at: x.confirmed_at, confirmed_by: x.confirmed_by, confirmed_name: x.confirmed_name,
  }]));
  const lunch = rows.LUNCH || null, dinner = rows.DINNER || null;
  return {
    day_vn: day,
    server_now: new Date(nowMs).toISOString(),
    lunch,
    dinner,
    lunch_prompt_due: !lunch && nowMs >= base + (10*60+55)*60_000 && nowMs < base + 11*60*60_000,
    dinner_prompt_due: !dinner && nowMs >= base + (17*60+55)*60_000 && nowMs < base + 18*60*60_000,
    unconfirmed_fallback: "DEFAULT_LATE_30_MINUTES",
  };
}

export function confirmMealChoice(
  state: DurableObjectState, body: { period?: string; choice?: string; actor_id?: string; actor_name?: string },
  nowMs = Date.now(),
): { status: number; payload: Record<string, unknown>; changed: boolean } {
  const period = String(body.period || "") as MealPeriod;
  const choice = String(body.choice || "") as MealChoice;
  const actorId = String(body.actor_id || "").trim();
  if (!actorId || !["LUNCH","DINNER"].includes(period) || !["EARLY","LATE"].includes(choice)) {
    return { status: 400, payload: { error: "INVALID_MEAL_CHOICE" }, changed: false };
  }
  const day = vnDayAt(nowMs), base = vnMidnightMs(day);
  const begin = base + (period === "LUNCH" ? 10*60+55 : 17*60+55)*60_000;
  const end = base + (period === "LUNCH" ? 11*60 : 18*60)*60_000;
  if (nowMs < begin || nowMs >= end) {
    return { status: 409, payload: { error: "MEAL_CONFIRM_OUTSIDE_WINDOW", day_vn: day }, changed: false };
  }
  const slot = slotFor(day, period, choice);
  const actorName = String(body.actor_name || "").slice(0, 120);
  state.storage.sql.exec(
    `INSERT OR IGNORE INTO d167_meal_choices
      (day_vn, period, choice, starts_at_ms, ends_at_ms, confirmed_at, confirmed_by, confirmed_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    day, period, choice, slot.from, slot.to, new Date(nowMs).toISOString(), actorId, actorName,
  );
  const inserted = first(state.storage.sql.exec<SqlRow>("SELECT changes() AS count").toArray());
  const current = first(state.storage.sql.exec<SqlRow>(
    "SELECT choice, starts_at_ms, ends_at_ms, confirmed_at, confirmed_by, confirmed_name FROM d167_meal_choices WHERE day_vn = ? AND period = ?",
    day, period,
  ).toArray());
  if (!current) return { status: 500, payload: { error: "MEAL_CHOICE_NOT_SAVED" }, changed: false };
  const winner = String(current.confirmed_by) === actorId && String(current.choice) === choice;
  const changed = Number(inserted?.count || 0) === 1;
  return {
    status: winner ? 200 : 409, changed,
    payload: {
      status: winner ? "CONFIRMED" : "ALREADY_CONFIRMED_BY_OTHER_REPORTER",
      day_vn: day, period, choice: current.choice,
      start_ms: Number(current.starts_at_ms), end_ms: Number(current.ends_at_ms),
      confirmed_at: current.confirmed_at, confirmed_by: current.confirmed_by,
      confirmed_name: current.confirmed_name,
    },
  };
}

export function dueMealDefaults(state: DurableObjectState, nowMs = Date.now()): Array<{day_vn:string;period:MealPeriod;event_id:string}> {
  const day = vnDayAt(nowMs), base = vnMidnightMs(day);
  const events: Array<{day_vn:string;period:MealPeriod;event_id:string}> = [];
  for (const period of ["LUNCH", "DINNER"] as const) {
    const cutoff = base + (period === "LUNCH" ? 11*60 : 18*60)*60_000;
    if (nowMs < cutoff) continue;
    const slot = slotFor(day, period, "LATE");
    state.storage.sql.exec(
      "INSERT OR IGNORE INTO d167_meal_choices (day_vn,period,choice,starts_at_ms,ends_at_ms,confirmed_at,confirmed_by,confirmed_name) VALUES (?,?,'LATE',?,?,?,?,?)",
      day, period, slot.from, slot.to, new Date(nowMs).toISOString(), "SYSTEM_MEAL_DEFAULT", "Hệ thống mặc định",
    );
    const changed = first(state.storage.sql.exec<SqlRow>("SELECT changes() AS count").toArray());
    if (Number(changed?.count || 0) === 1) events.push({ day_vn: day, period, event_id: crypto.randomUUID() });
  }
  return events;
}

export function nextMealPromptMs(state: DurableObjectState, nowMs = Date.now()): number | null {
  const candidates: number[] = [];
  for (let d = 0; d <= 1; d++) {
    const day = vnDayAt(nowMs + d * DAY_MS);
    const base = vnMidnightMs(day);
    for (const period of ["LUNCH","DINNER"] as const) {
      const promptAt = base + (period === "LUNCH" ? 10*60+55 : 17*60+55)*60_000;
      if (promptAt <= nowMs) continue;
      const found = first(state.storage.sql.exec<SqlRow>(
        "SELECT 1 AS done FROM d167_meal_prompt_markers WHERE day_vn = ? AND period = ?", day, period,
      ).toArray());
      if (!found) candidates.push(promptAt);
    }
  }
  return candidates.length ? Math.min(...candidates) : null;
}

export function dueMealPrompts(state: DurableObjectState, nowMs = Date.now()): Array<{day_vn:string; period:MealPeriod; event_id:string}> {
  const result: Array<{day_vn:string;period:MealPeriod;event_id:string}> = [];
  const day = vnDayAt(nowMs), base = vnMidnightMs(day);
  for (const period of ["LUNCH","DINNER"] as const) {
    const promptAt = base + (period === "LUNCH" ? 10*60+55 : 17*60+55)*60_000;
    if (nowMs < promptAt) continue;
    const already = first(state.storage.sql.exec<SqlRow>(
      "SELECT 1 AS done FROM d167_meal_prompt_markers WHERE day_vn = ? AND period = ?", day, period,
    ).toArray());
    if (already) continue;
    state.storage.sql.exec(
      "INSERT OR IGNORE INTO d167_meal_prompt_markers (day_vn, period, created_at) VALUES (?, ?, ?)",
      day, period, new Date(nowMs).toISOString(),
    );
    result.push({ day_vn: day, period, event_id: crypto.randomUUID() });
  }
  return result;
}

export function recalculateMealAdjustedDeadlines(state: DurableObjectState): { batches: number; tickets: number } {
  const batchRows = state.storage.sql.exec<SqlRow>(
    "SELECT batch_id, first_report_at, d167_auto_skip_minutes AS minutes FROM report_batches WHERE status = 'PENDING' AND d167_auto_skip_minutes > 0"
  ).toArray();
  let batches = 0, tickets = 0;
  for (const row of batchRows) {
    const deadline = mealAdjustedDeadline(state, String(row.first_report_at || ""), Number(row.minutes));
    if (!deadline) continue;
    state.storage.sql.exec(
      "UPDATE report_batches SET auto_skip_deadline_at = ? WHERE batch_id = ? AND status = 'PENDING'",
      deadline, row.batch_id,
    );
    state.storage.sql.exec(
      "UPDATE report_tickets SET auto_skip_deadline_at = ? WHERE batch_id = ? AND status = 'OPEN' AND auto_skip_allowed_at IS NULL",
      deadline, row.batch_id,
    );
    batches++;
  }
  const ticketRows = state.storage.sql.exec<SqlRow>(
    `SELECT t.ticket_id, t.reported_at, t.d167_auto_skip_minutes AS minutes
       FROM report_tickets t JOIN report_batches b ON b.batch_id = t.batch_id
      WHERE b.status = 'PENDING' AND t.status = 'OPEN'
        AND t.auto_skip_allowed_at IS NULL AND t.d167_auto_skip_minutes > 0`
  ).toArray();
  for (const row of ticketRows) {
    const deadline = mealAdjustedDeadline(state, String(row.reported_at || ""), Number(row.minutes));
    if (!deadline) continue;
    state.storage.sql.exec(
      "UPDATE report_tickets SET auto_skip_deadline_at = ? WHERE ticket_id = ? AND status = 'OPEN' AND auto_skip_allowed_at IS NULL",
      deadline, row.ticket_id,
    );
    tickets++;
  }
  return { batches, tickets };
}

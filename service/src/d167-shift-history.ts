/** D167 Web-only bounded operations history; reuses existing DO SQL and audit retention. */
type Row = Record<string, SqlStorageValue>;
const vnDay = (ms: number): string => new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10);
export function readD167ShiftHistory(state: DurableObjectState, rawDays: number, nowMs = Date.now()): Record<string, unknown> {
  const days = Number.isFinite(rawDays) ? Math.max(1, Math.min(60, Math.trunc(rawDays))) : 7;
  const until = vnDay(nowMs);
  const from = vnDay(nowMs - (days - 1) * 86_400_000);
  const meals = state.storage.sql.exec<Row>(
    "SELECT day_vn,period,choice,confirmed_at,confirmed_by,confirmed_name FROM d167_meal_choices WHERE day_vn BETWEEN ? AND ? ORDER BY day_vn DESC,period",
    from, until,
  ).toArray().map(r => ({
    day_vn: String(r.day_vn), period: String(r.period), choice: String(r.choice),
    confirmed_at: String(r.confirmed_at), confirmed_by: String(r.confirmed_by),
    confirmed_name: String(r.confirmed_name || ""),
  }));
  const audit = state.storage.sql.exec<Row>(
    "SELECT action,created_at,actor_user_id,actor_display_name,target_id,metadata_json FROM audit_log WHERE created_at >= ? AND action IN ('MEAL_BREAK_CONFIRM','MEAL_BREAK_EDIT','MEAL_BREAK_DEFAULT','OPERATING_SCHEDULE_CHANGE') ORDER BY created_at DESC LIMIT 300",
    from,
  ).toArray().map(r => {
    let meta: Record<string, unknown> = {};
    try { const parsed: unknown = JSON.parse(String(r.metadata_json || "{}")); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) meta = parsed as Record<string, unknown>; }
    catch { /* Historic incomplete metadata is not reconstructed. */ }
    return {
      action: String(r.action), at: String(r.created_at),
      actor: String(r.actor_display_name || meta.confirmed_name || meta.edited_name || r.actor_user_id || "Hệ thống").slice(0, 120),
      target: String(r.target_id || "").slice(0, 100),
      day_vn: String(meta.day_vn || (r.action === "OPERATING_SCHEDULE_CHANGE" ? String(meta.schedule_key || "").replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3") : vnDay(Date.parse(String(r.created_at))))),
      details: {
        period: String(meta.period || ""), before_choice: String(meta.before_choice || ""), choice: String(meta.choice || meta.after_choice || ""),
        decision: String(meta.decision || ""), open_until_ms: Number(meta.open_until_ms || 0), version: Number(meta.version || 0),
      },
    };
  }).filter(r => r.day_vn >= from && r.day_vn <= until);
  return { from_vn: from, to_vn: until, days, meals, events: audit, retention_notice: "Lịch sử chỉ gồm các sự kiện thực sự đã ghi nhận." };
}

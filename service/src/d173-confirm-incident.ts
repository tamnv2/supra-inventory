// D173-E278: one email per confirmed PRIMARY outage; no new Worker bindings.
export type IncidentAction = "FAILED" | "RECOVERED" | "SENT" | "FAILED_SEND";
export interface IncidentState {
  active: boolean;
  incident_id: string;
  claimed_at_ms: number;
  delivery: "CLAIMED" | "SENT" | "FAILED";
}

export function decideIncident(current: IncidentState | null, action: IncidentAction,
  incidentId: string, now: number, healthyForMs = 0,
): { status: string; state: IncidentState | null; shouldSend: boolean } {
  if (action === "RECOVERED") {
    if (!current?.active || healthyForMs < 300000)
      return { status: "NOT_REARMED", state: current, shouldSend: false };
    return { status: "REARMED", state: { ...current, active: false }, shouldSend: false };
  }
  if (action === "SENT" || action === "FAILED_SEND") {
    if (!current || current.incident_id !== incidentId || !current.active)
      return { status: "STALE_RECEIPT", state: current, shouldSend: false };
    return { status: action, state: { ...current, delivery: action === "SENT" ? "SENT" : "FAILED" }, shouldSend: false };
  }
  if (current?.active)
    return { status: "SUPPRESSED_ACTIVE_INCIDENT", state: current, shouldSend: false };
  if (current && now - current.claimed_at_ms < 300000)
    return { status: "SUPPRESSED_COOLDOWN", state: current, shouldSend: false };
  const next: IncidentState = { active: true, incident_id: incidentId, claimed_at_ms: now, delivery: "CLAIMED" };
  return { status: "CLAIMED", state: next, shouldSend: true };
}

interface IncidentRow extends Record<string, SqlStorageValue> { value_json: string }
const KEY = "d173-e278:primary-confirm-incident";

function reply(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// Only reachable via the existing Worker -> InventoryCore internal binding.
export async function handleD173ConfirmIncidentCore(
  state: DurableObjectState, request: Request,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/d173/confirm-incident" || request.method !== "POST") return null;
  let body: { action?: IncidentAction; incident_id?: string; healthy_for_ms?: number };
  try { body = await request.json() as typeof body; }
  catch { return reply({ error: "INVALID_JSON" }, 400); }
  const action = String(body.action || "") as IncidentAction;
  const id = String(body.incident_id || "");
  if (!["FAILED", "RECOVERED", "SENT", "FAILED_SEND"].includes(action) ||
      !/^[a-f0-9]{32}$/.test(id))
    return reply({ error: "INVALID_INCIDENT" }, 400);
  const now = Date.now();
  const healthyMs = Math.max(0, Math.min(3600000, Math.trunc(Number(body.healthy_for_ms || 0))));
  const result = state.storage.transactionSync(() => {
    const stored = state.storage.sql.exec<IncidentRow>(
      "SELECT value_json FROM app_config WHERE key = ? LIMIT 1", KEY,
    ).toArray()[0];
    let current: IncidentState | null = null;
    try { current = stored?.value_json ? JSON.parse(String(stored.value_json)) as IncidentState : null; }
    catch { current = null; }
    const decision = decideIncident(current, action, id, now, healthyMs);
    if (decision.state && decision.state !== current) {
      state.storage.sql.exec(
        "INSERT INTO app_config (key, value_json, updated_at, updated_by) VALUES (?, ?, ?, ?) "+
        "ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, "+
        "updated_at=excluded.updated_at, updated_by=excluded.updated_by",
        KEY, JSON.stringify(decision.state), new Date(now).toISOString(), "D173_E278",
      );
    }
    return decision;
  });
  return reply({ status: result.status, should_send: result.shouldSend });
}

export function buildConfirmIncidentMail(spec: {
  incidentId: string; machine: string;
  reason: "SESSION_EXPIRED" | "WEB_CONFIRM_UNAVAILABLE";
  standby: "NOT_TRANSFERRED" | "TRANSFERRED" | "NO_READY_STANDBY";
  atMs: number;
}): { subject: string; body: string } {
  const t = new Date(spec.atMs + 7 * 3600000).toISOString();
  const when = t.slice(8, 10) + "/" + t.slice(5, 7) + "/" + t.slice(0, 4) + " " + t.slice(11, 19);
  const reason = spec.reason === "SESSION_EXPIRED"
    ? "Phiên Supra hết hạn" : "Web không khả dụng dù phiên còn hiệu lực";
  const detail = spec.reason === "SESSION_EXPIRED"
    ? "Trang WMS yêu cầu xác thực lại, chưa thể confirm PickList."
    : "Web còn đăng nhập nhưng không thể lấy dữ liệu hoặc xác nhận PickList.";
  const standby = spec.standby === "TRANSFERRED" ? "Đã chuyển"
    : spec.standby === "NO_READY_STANDBY" ? "Không có Agent khả dụng" : "Chưa chuyển";
  return {
    subject: "[SUPRA 1291] CẢNH BÁO: Agent chính không thể confirm PickList",
    body: [
      "CẢNH BÁO SỰ CỐ AGENT – SUPRA 1291", "",
      "Hệ thống phát hiện Agent chính không thể thực hiện xác nhận PickList.", "",
      "Thời gian: " + when, "Agent gặp lỗi: " + spec.machine,
      "Nguyên nhân: " + reason, "Chi tiết lỗi: " + detail,
      "Chuyển Agent dự phòng: " + standby, "",
      "Ảnh hưởng: Chức năng confirm PickList trên Agent chính bị gián đoạn.",
      "Mã sự cố: " + spec.incidentId, "",
      "Email được gửi tự động khi phát hiện sự cố.",
      "Các lỗi lặp lại trong cùng sự cố sẽ không gửi thêm email.",
    ].join("\n"),
  };
}

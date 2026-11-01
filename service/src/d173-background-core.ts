import { readAndroidAlertWindow } from "./alert-window-core";
import { handleNotificationCoreRequest } from "./notifications-core";
import { handleOperationalV2CoreRequest } from "./operational-v2-core";
import { readPendingRuntimeLogArchives } from "./runtime-logs-core";

type BackgroundContext = { reconcileOperatingSchedule: () => Promise<void> };

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function internal(path: string, body?: Record<string, unknown>): Request {
  return new Request("https://inventory-core.internal" + path, body === undefined ? undefined : {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

/** Private Worker-to-Core operations. Call existing handlers in this invocation,
 * never fetch the object again or put notification fanout on the mutation path. */
export async function handleD173BackgroundCoreRequest(
  state: DurableObjectState, request: Request, context: BackgroundContext,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname === "/notifications/prepare") {
    let body: Record<string, unknown>;
    try {
      const value = await request.json();
      if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "INVALID_JSON" }, 400);
      body = value as Record<string, unknown>;
    } catch { return json({ error: "INVALID_JSON" }, 400); }
    await context.reconcileOperatingSchedule();
    if (readAndroidAlertWindow(state).is_open !== true) return json({ is_open: false, tokens: [] });
    let eventSeq = "", batchVersion = "";
    const eventId = String(body.result_event_id || "");
    if (eventId) {
      try {
        const eventResponse = await handleOperationalV2CoreRequest(state,
          internal("/operational/realtime/event?event_id=" + encodeURIComponent(eventId)));
        if (eventResponse?.ok) {
          const payload = await eventResponse.json() as { event?: { seq?: number; batch_version?: number } };
          if (payload.event?.seq != null) eventSeq = String(payload.event.seq);
          if (payload.event?.batch_version != null) batchVersion = String(payload.event.batch_version);
        }
      } catch { /* The old event endpoint's HTTP 500 left metadata empty. */ }
    }
    const targets = await handleNotificationCoreRequest(state, internal("/notifications/targets", body));
    if (!targets) return json({ error: "NOTIFICATION_TARGET_HANDLER_UNAVAILABLE" }, 503);
    if (!targets.ok) return targets;
    return json({ ...await targets.json() as Record<string, unknown>, is_open: true, event_seq: eventSeq, batch_version: batchVersion });
  }
  if (request.method === "POST" && url.pathname === "/notifications/delivery-complete") {
    let body: Record<string, unknown>;
    try {
      const value = await request.json();
      if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "INVALID_JSON" }, 400);
      body = value as Record<string, unknown>;
    } catch { return json({ error: "INVALID_JSON" }, 400); }
    let attempts: Response | null;
    try { attempts = await handleNotificationCoreRequest(state, internal("/notifications/delivery-attempts", body)); }
    catch { attempts = json({ error: "NOTIFICATION_ATTEMPT_FAILED" }, 500); }
    if (!attempts) return json({ error: "NOTIFICATION_ATTEMPT_HANDLER_UNAVAILABLE" }, 503);
    const invalid = Array.isArray(body.invalid_tokens) ? body.invalid_tokens : [];
    // The old separate attempt request could return HTTP 500 and still allow
    // invalid-token cleanup. Preserve that independent cleanup on SQL failure.
    const disabled = invalid.length ? await handleNotificationCoreRequest(state,
      internal("/notifications/disable-tokens", { tokens: invalid })) : null;
    if (!attempts.ok) return attempts;
    if (disabled && !disabled.ok) return disabled;
    return json({ ...await attempts.json() as Record<string, unknown>,
      ...(disabled ? await disabled.json() as Record<string, unknown> : { disabled: 0 }) });
  }
  if (request.method === "GET" && url.pathname === "/maintenance/plan") {
    // A failing log read must not suppress an HR retry, or vice versa. A failed
    // section asks the Worker to use that section's established retry path.
    let runtimeLogs: Record<string, unknown>;
    try {
      runtimeLogs = { ...readPendingRuntimeLogArchives(state, Number(url.searchParams.get("limit") || 20)), ok: true };
    } catch { runtimeLogs = { ok: false, error: "LOG_PENDING_UNAVAILABLE" }; }
    let hrSync: Record<string, unknown>;
    try {
      const row = state.storage.sql.exec<{ value_json: string }>(
        "SELECT value_json FROM app_config WHERE key = 'd161_hr_sync_state' LIMIT 1").toArray()[0];
      let sync: Record<string, unknown> | null = null;
      try { sync = row?.value_json ? JSON.parse(row.value_json) as Record<string, unknown> : null; } catch { sync = null; }
      hrSync = { ok: true, sync };
    } catch { hrSync = { ok: false, error: "HR_SYNC_UNAVAILABLE" }; }
    return json({ runtime_logs: runtimeLogs, hr_sync: hrSync });
  }
  return null;
}

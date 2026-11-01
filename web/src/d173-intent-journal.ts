// Uncertain online outcomes are retained in bounded RAM; never an offline queue.
type Intent = { key: string; requestId: string };
const intents = new Map<string, Intent>();

export function beginIntent(owner: string, operation: string, args: Record<string, unknown>, proposedId: string): Intent {
  const business = Object.fromEntries(Object.keys(args).filter(key => !["request_id", "d173_request_id", "read_model"].includes(key)).sort().map(key => [key, args[key]]));
  const key = JSON.stringify([owner, operation, business]);
  const previous = intents.get(key);
  if (previous) return previous;
  if (intents.size >= 32) throw new Error("Cần xác minh các thao tác chưa có kết quả trước khi gửi thêm.");
  const intent = { key, requestId: proposedId };
  intents.set(key, intent);
  return intent;
}

export function settleIntent(intent: Intent, status: number): void {
  if ((status >= 200 && status < 300) || (status >= 400 && status < 500 && status !== 429)) intents.delete(intent.key);
}

export function clearIntents(): void { intents.clear(); }

export function interactiveIntentOwner(token: string, userId: string): string {
  try {
    const segment = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(segment));
    if (!claims.app_session_channel || !(Number(claims.app_session_generation) > 0)) throw new Error("missing interactive scope");
    return JSON.stringify([userId, claims.app_session_channel, claims.app_session_generation]);
  } catch { return JSON.stringify([userId, token]); }
}

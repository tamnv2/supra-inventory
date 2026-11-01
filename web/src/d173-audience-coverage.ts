export type AudienceScope = { channel: string; generation: number };
export function audienceSessionScope(token: string): AudienceScope | null {
  try {
    const claims = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const generation = Number(claims.app_session_generation);
    const channel = String(claims.app_session_channel || "");
    return ["WEB", "ANDROID"].includes(channel) && Number.isSafeInteger(generation) && generation > 0 ? { channel, generation } : null;
  } catch { return null; }
}

export function sameAudienceSession(left: { id_token: string; user: { user_id: string; role: string } } | null,
  right: { id_token: string; user: { user_id: string; role: string } } | null): boolean {
  if (!left || !right || left.user.user_id !== right.user.user_id || left.user.role !== right.user.role) return false;
  const a = audienceSessionScope(left.id_token);
  const b = audienceSessionScope(right.id_token);
  return a && b ? a.channel === b.channel && a.generation === b.generation : left.id_token === right.id_token;
}

export function audienceCoversGap(value: unknown, expected: {
  appliedSeq: number; incomingSeq: number; epoch: string; userId: string; role: string;
  channel: string; generation: number;
}): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proof = value as Record<string, unknown>;
  return proof.complete === true && Boolean(expected.epoch) && Boolean(expected.userId) && Boolean(expected.role) &&
    Number.isSafeInteger(expected.appliedSeq) && expected.appliedSeq > 0 && Number.isSafeInteger(expected.incomingSeq) &&
    expected.incomingSeq > expected.appliedSeq + 1 && Number.isSafeInteger(expected.generation) && expected.generation > 0 &&
    proof.stream_epoch === expected.epoch && proof.user_id === expected.userId && proof.role === expected.role &&
    proof.session_channel === expected.channel && proof.session_generation === expected.generation &&
    proof.from_seq === expected.appliedSeq + 1 && proof.through_seq === expected.incomingSeq - 1;
}

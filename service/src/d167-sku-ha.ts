import { getServiceAccountAccessToken } from "./hr-source";

export type D167PrimaryProof = {
  valid: boolean;
  reason: "VERIFIED" | "VERIFIER_CONFIG_MISSING" | "INVALID_IDENTITY" |
    "FIRESTORE_ROLES_READ_FAILED" | "FIRESTORE_LEASE_READ_FAILED" |
    "FIRESTORE_ROLES_MISMATCH" | "FIRESTORE_LEASE_MISMATCH" |
    "FIRESTORE_LEASE_STALE" | "FIRESTORE_VERIFIER_UNAVAILABLE";
};

/** D167 Beta: authoritative Firestore roles AND fresh generation lease.
 * Fixed reason codes use the two reads already required by this verifier.
 * Never trust the Agent's claimed role; no raw Firebase response is logged.
 */
export async function verifyD167AgentPrimary(
  env: { FIREBASE_PROJECT_ID: string; GOOGLE_RUNTIME_SA_JSON?: string },
  instanceId: string, generation: string,
): Promise<D167PrimaryProof> {
  const deny = (reason: D167PrimaryProof["reason"]): D167PrimaryProof =>
    ({valid:false,reason});
  if (!env.GOOGLE_RUNTIME_SA_JSON) return deny("VERIFIER_CONFIG_MISSING");
  if (!/^[a-zA-Z0-9:_-]{6,150}$/.test(instanceId) ||
      !/^[A-Za-z0-9-]{16,150}$/.test(generation)) return deny("INVALID_IDENTITY");
  try {
    const token = await getServiceAccountAccessToken(
      env.GOOGLE_RUNTIME_SA_JSON, "https://www.googleapis.com/auth/datastore",
    );
    const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/relay_poc_coordination/`;
    const headers = { authorization: `Bearer ${token.accessToken}`, accept: "application/json" };
    const [rolesResponse, leaseResponse] = await Promise.all([
      fetch(base + "roles", { headers }),
      fetch(base + "lease_" + encodeURIComponent(generation), { headers }),
    ]);
    // Do not log response bodies, headers, URLs or credentials.
    if (!rolesResponse.ok) return deny("FIRESTORE_ROLES_READ_FAILED");
    if (!leaseResponse.ok) return deny("FIRESTORE_LEASE_READ_FAILED");
    const roles = await rolesResponse.json() as { fields?: Record<string,{stringValue?:string}> };
    const lease = await leaseResponse.json() as {
      fields?: Record<string,{stringValue?:string;integerValue?:string}> };
    const r = roles.fields || {};
    const l = lease.fields || {};
    if (r.primary_agent_instance_id?.stringValue !== instanceId ||
        r.generation?.stringValue !== generation) return deny("FIRESTORE_ROLES_MISMATCH");
    if (l.primary_agent_instance_id?.stringValue !== instanceId ||
        l.generation?.stringValue !== generation) return deny("FIRESTORE_LEASE_MISMATCH");
    const heartbeat = Number(l.heartbeat_at_ms?.integerValue || 0);
    if (!(heartbeat > 0 && Math.abs(Date.now() - heartbeat) <= 45_000))
      return deny("FIRESTORE_LEASE_STALE");
    return {valid:true,reason:"VERIFIED"};
  } catch {
    return deny("FIRESTORE_VERIFIER_UNAVAILABLE");
  }
}

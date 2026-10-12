import { getServiceAccountAccessToken } from "./hr-source";

/** Server-side Firebase authority check; never accept an Agent's self-claimed PRIMARY role. */
export async function verifyD167AgentPrimary(
  env: { FIREBASE_PROJECT_ID: string; GOOGLE_RUNTIME_SA_JSON?: string },
  instanceId: string, generation: string,
): Promise<boolean> {
  if (!env.GOOGLE_RUNTIME_SA_JSON ||
      !/^[a-zA-Z0-9:_-]{6,150}$/.test(instanceId) ||
      !/^[A-Za-z0-9-]{16,150}$/.test(generation)) return false;
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
    if (!rolesResponse.ok || !leaseResponse.ok) return false;
    const roles = await rolesResponse.json() as { fields?: Record<string,{stringValue?:string}> };
    const lease = await leaseResponse.json() as {
      fields?: Record<string,{stringValue?:string;integerValue?:string}> };
    const r = roles.fields || {};
    const l = lease.fields || {};
    if (r.primary_agent_instance_id?.stringValue !== instanceId ||
        r.generation?.stringValue !== generation ||
        l.primary_agent_instance_id?.stringValue !== instanceId ||
        l.generation?.stringValue !== generation) return false;
    const heartbeat = Number(l.heartbeat_at_ms?.integerValue || 0);
    // Use existing HA 10-second heartbeat, tolerate bounded transport jitter only.
    return heartbeat > 0 && Math.abs(Date.now() - heartbeat) <= 45_000;
  } catch {
    return false; // No fallback to user-provided role/generation.
  }
}

import { randomUUID } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { ensureDedicatedTestProject, requireTestEmployeeCode, newGrant, hashGrant, canRedeem } from "./session-logic.mjs";

initializeApp();
const db = getFirestore();
const auth = getAuth();
const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";

function reject(response, code, message) {
  response.status(code).json({ error: message });
}
async function authorize(request) {
  const header = String(request.get("authorization") || "");
  if (!header.startsWith("Bearer ")) throw new Error("AUTH_REQUIRED");
  return auth.verifyIdToken(header.slice(7), true);
}
function jsonOnly(request) {
  if (request.method !== "POST" || !request.is("application/json")) {
    throw new Error("INVALID_REQUEST");
  }
}
export const d173LauncherPoc = onRequest({
  region: "asia-southeast1",
  cors: false,
  maxInstances: 2,
  invoker: "public",
}, async (request, response) => {
  response.set("Cache-Control", "no-store");
  try {
    ensureDedicatedTestProject(project);
    jsonOnly(request);
    const action = request.path.replace(/^\/+/, "");
    const body = request.body || {};
    const now = Date.now();

    if (action === "redeem") {
      // The opaque grant only leaves Launcher through same-signature Android IPC.
      const hash = hashGrant(body.grant);
      const grantRef = db.collection("poc_grants").doc(hash);
      const record = await db.runTransaction(async tx => {
        const g = await tx.get(grantRef);
        if (!g.exists) throw new Error("INVALID_OR_USED_GRANT");
        const grant = g.data();
        const sessRef = db.collection("poc_sessions").doc(grant.session_id);
        const sess = await tx.get(sessRef);
        if (!canRedeem(grant, now, sess.exists ? { id: sess.id, ...sess.data() } : null)) {
          throw new Error("INVALID_OR_EXPIRED_GRANT");
        }
        tx.update(grantRef, { used: true, redeemed_at_ms: now });
        return { uid: grant.uid, session_id: sess.id, generation: sess.data().generation };
      });
      const token = await auth.createCustomToken(record.uid, { poc_session_generation: record.generation });
      response.json({ custom_token: token, session_id: record.session_id,
        uid: record.uid, generation: record.generation });
      return;
    }

    const identity = await authorize(request);
    if (action === "open") {
      const code = requireTestEmployeeCode(body.employee_code);
      const approved = await db.collection("poc_test_users").doc(identity.uid).get();
      if (!approved.exists || approved.data().active !== true ||
          approved.data().employee_code !== code) {
        reject(response, 403, "TEST_IDENTITY_NOT_APPROVED");
        return;
      }
      const sessionId = randomUUID();
      const generation = Math.floor(now / 1000);
      await db.collection("poc_sessions").doc(sessionId).create({
        uid: identity.uid, employee_code: code, active: true, generation,
        created_at_ms: now, expires_at_ms: now + 12 * 60 * 60 * 1000,
      });
      response.json({ session_id: sessionId, generation, uid: identity.uid });
      return;
    }
    if (action === "grant") {
      const id = String(body.session_id || "");
      const current = await db.collection("poc_sessions").doc(id).get();
      if (!current.exists || !current.data().active ||
          current.data().uid !== identity.uid ||
          current.data().expires_at_ms <= now) {
        reject(response, 403, "SESSION_NOT_ACTIVE");
        return;
      }
      const code = newGrant();
      await db.collection("poc_grants").doc(hashGrant(code)).create({
        uid: identity.uid, session_id: id,
        used: false, expires_at_ms: now + 30000,
      });
      response.json({ grant: code, expires_in_seconds: 30 });
      return;
    }
    if (action === "logout") {
      const id = String(body.session_id || "");
      const ref = db.collection("poc_sessions").doc(id);
      await db.runTransaction(async tx => {
        const old = await tx.get(ref);
        if (!old.exists || old.data().uid !== identity.uid) {
          throw new Error("INVALID_SESSION");
        }
        if (old.data().active) tx.update(ref, {
          active: false, revoked_at_ms: now, status: "REVOKED",
        });
      });
      response.json({ revoked: true });
      return;
    }
    reject(response, 404, "UNKNOWN_TEST_ACTION");
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    reject(response, message === "NOT_DEDICATED_TEST_PROJECT" ? 503 : 400,
      /^INVALID|^AUTH_REQUIRED|^NOT_DEDICATED|^TEST_/.test(message)
        ? message : "TEST_REQUEST_FAILED");
  }
});

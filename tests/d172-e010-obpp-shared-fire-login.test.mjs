import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const worker = readFileSync(new URL("../service/src/index.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt", import.meta.url), "utf8");
const obpp = worker.slice(worker.indexOf("async function handleObppApp("), worker.indexOf("async function setRootEffectiveRole("));

test("D172 login uses registered Inventory user and shared Firebase readiness only", () => {
  assert.match(obpp, /getUserByUsername\(env,username\)/);
  assert.match(obpp, /ensureFirebasePasswordReady\(env,user\)/);
  assert.match(obpp, /signInWithFirebasePassword\(env\.FIREBASE_WEB_API_KEY!,email,password\)/);
  assert.match(obpp, /verifyPrivilegedProof\(env,user,password,true\)/);
  assert.match(obpp, /retirePrivilegedStaticPassword\(env,user\)/);
  assert.match(obpp, /OBPP_ROLE_REQUIRED/);
  assert.doesNotMatch(obpp, /activateInteractiveSession\(/);
  assert.match(obpp, /\/obpp1291\/session\/activate/);
  assert.match(obpp, /app_session_channel:"OBPP1291"/);
});

test("D172 never converts account/permission errors to unhelpful HTTP500", () => {
  assert.match(obpp, /OBPP_ACCOUNT_LOOKUP_UNAVAILABLE/);
  assert.match(obpp, /OBPP_SESSION_ACTIVATION_UNAVAILABLE/);
  assert.match(obpp, /OBPP_FIREBASE_TOKEN_UNAVAILABLE/);
  assert.match(obpp, /return json\(\{error:failure,message:/);
  assert.match(obpp, /\},503\)/);
  assert.doesNotMatch(obpp, /console\.error\([^\n]*username/);
  assert.doesNotMatch(obpp, /console\.error\([^\n]*password/);
});

test("D172 UI surfaces bounded server cause, protects other channels and uses existing OTP endpoint", () => {
  assert.match(client, /\/api\/auth\/privileged-code/);
  assert.match(client, /\/api\/obpp1291\/session\/login/);
  assert.match(client, /if \(code == 401 && authenticated\) showLogin\(\)/);
  assert.match(client, /safeError/);
  assert.match(client, /\[" \+ safeError \+ "\]/);
  assert.doesNotMatch(client, /app_session_generation/);
});

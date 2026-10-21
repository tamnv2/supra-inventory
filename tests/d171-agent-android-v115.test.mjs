import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(p, "utf8");
const picker = read("android/app/src/main/java/cd/cc/supra/inventory/beta/RelayPocClient.kt");
const agent = read("relay-agent/FirestoreConfirmationTransport.cs");
const rules = read("firebase/firestore.rules");
const gradle = read("android/app/build.gradle.kts");
const changelog = JSON.parse(read("android/release-notes.json"));

test("vc115 speaks unchanged v139/v140 same-document request/ACK protocol", () => {
  assert.match(picker, /JOB_COLLECTION = "relay_poc_jobs"/);
  assert.match(picker, /val requestId = UUID\.randomUUID\(\)\.toString\(\)/);
  assert.match(picker, /"source" to "ANDROID_CONFIRM_V1"/);
  assert.match(picker, /"recovery_protocol" to 1/);
  assert.match(picker, /"created_at" to FieldValue\.serverTimestamp\(\)/);
  assert.match(picker, /doc\.addSnapshotListener/);
  assert.match(agent, /"status", StringField\("ACK"\)/);
  assert.match(agent, /"agent_instance_id", StringField\(_instanceId\)/);
  assert.match(agent, /"lookup_status", StringField\(outcome\.Result/);
  assert.match(rules, /match \/relay_poc_jobs\/\{jobId\}/);
  assert.match(rules, /request\.resource\.data\.request_id == jobId/);
  assert.match(rules, /request\.resource\.data\.source == 'ANDROID_CONFIRM_V1'/);
});

test("vc115 accepts only same-request same-Picker same-session ACK", () => {
  assert.match(picker, /parseAck\(snapshot, requestId, identity\)/);
  assert.match(picker, /parseAck\(latest, requestId, identity\)/);
  assert.match(picker, /parseAck\(snapshot, requestId, identity\)/);
  const part = picker.slice(picker.indexOf("private fun parseAck("), picker.indexOf("private fun readAckFromServer("));
  for (const marker of [
    'snapshot.getString("request_id") != requestId',
    'snapshot.getString("picker_uid") != identity.uid',
    'snapshot.getLong("picker_session_generation") != identity.sessionGeneration',
    'snapshot.getString("source") != "ANDROID_CONFIRM_V1"',
    'snapshot.getString("status") != "ACK"',
    'snapshot.metadata.hasPendingWrites()',
  ]) assert.ok(part.includes(marker), marker);
  assert.match(picker, /doc\.get\(Source\.SERVER\)/);
  assert.doesNotMatch(part, /set\(/); // PDA never mutates a received ACK
});

test("vc115 recovery grant is server-verified and cannot be taken from another Picker", () => {
  const part = picker.slice(picker.indexOf("private fun isVerifiedRecoveryGrant("), picker.indexOf("private fun parseAck("));
  assert.match(part, /snapshot\.metadata\.isFromCache/);
  assert.match(part, /snapshot\.getString\("request_id"\) != requestId/);
  assert.match(part, /snapshot\.getString\("picker_uid"\) != identity\.uid/);
  assert.match(part, /snapshot\.getLong\("picker_session_generation"\) != identity\.sessionGeneration/);
  assert.match(part, /snapshot\.getLong\("recovery_protocol"\) != 1L/);
  assert.match(part, /snapshot\.getString\("recovery_admin_user_id"\)/);
  assert.match(rules, /request\.resource\.data\.status == 'PENDING'/);
  assert.match(rules, /request\.resource\.data\.recovery_generation/);
});

test("vc115 keeps 20/35s bounded single-request recovery and avoids repeated timeout read", () => {
  assert.match(picker, /TOTAL_WAIT_MS = 20_000L/);
  assert.match(picker, /VERIFIED_FAILOVER_WAIT_MS = 35_000L/);
  assert.match(picker, /!recoveryServerReadAttempted \|\| recoveryProofSeen\.get\(\)/);
  assert.match(picker, /createRequestWithRecovery\(doc, fields, requestId, identity\.uid\)/);
  assert.match(picker, /val terminal = parseAck\(latest, requestId, identity\)/);
  assert.doesNotMatch(picker, /collection\("relay_poc_jobs"\)\.add\(/);
});

test("vc115/vc116 retain signed package and next OTA includes approved alert fixes", () => {
  assert.match(gradle, /applicationId = "cd\.cc\.supra\.inventory\.beta"/);
  assert.match(gradle, /UPDATE_RELEASE_API/);
  assert.match(gradle, /TRUSTED_SIGNER_SHA256/);
  assert.ok(changelog.release_notes.every(x => x.startsWith("vc116:")));
  assert.equal(changelog.release_notes.length, 3);
});

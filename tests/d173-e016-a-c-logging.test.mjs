import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const app = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
const sql = read("service/src/operational-v2-core.ts");
const readModel = read("service/src/read-model-core.ts");
const worker = read("service/src/index.ts");
const agent = read("relay-agent/D119AgentFeatures.cs");
const client = read("relay-agent/D173ReporterPresence.cs");
const groupContact = read("relay-agent/D168GroupPickerContact.cs");
const telemetry = read("android/app/src/main/java/cd/cc/supra/inventory/beta/D166UsageAudit.kt");

test("signed Android OTA has measured bytes/speed, unknown-length fallback and verification separate from installation", () => {
  assert.match(app, /connection\.contentLengthLong/);
  assert.match(app, /received \+= count/);
  assert.match(app, /speedBps \/ 1048576\.0/);
  assert.match(app, /received \* 100L/);
  assert.match(app, /total <= 0/);
  assert.match(app, /received != total/);
  assert.match(app, /sha256\(temp\) != expected/);
  assert.match(app, /verifyDownloadedApk\(temp, info\)/);
  assert.match(app, /verifyInstalledSignerTrusted\(\)/);
  assert.match(app, /requestInstall\(apk\)/);
  assert.match(app, /inactive_bucket=\$bucket/);
});
test("new links only originate from a resolved episode on the same VN calendar day", () => {
  const trigger = sql.split("CREATE TRIGGER trg_v2_batch_recurrence")[1].split("DROP TRIGGER IF EXISTS trg_v2_ticket_insert_version")[0];
  assert.match(trigger, /date\(prior\.resolved_at, '\+7 hours'\) = date\(NEW\.first_report_at, '\+7 hours'\)/);
  assert.match(trigger, /prior\.status IN \('HAS_STOCK','SKIP_ALLOWED'\)/);
  assert.equal((sql.match(/LEFT JOIN report_batches p ON p\.batch_id = b\.previous_batch_id[\s\S]{0,110}date\(p\.resolved_at, '\+7 hours'\)/g)||[]).length, 3);
  assert.match(sql, /WHERE b\.previous_batch_id IS NOT NULL[\s\S]*?date\(prior\.resolved_at, '\+7 hours'\)/);
});
test("Reporter roster comes only from bounded current authenticated WebSocket role and Agent-only route", () => {
  assert.match(readModel, /state\.getWebSockets\(\)/);
  assert.match(readModel, /a\.role !== "REPORTER"/);
  assert.match(readModel, /reporters: Array\.from\(reporters\.values\(\)\)\.slice\(0, 100\)/);
  assert.match(worker, /url\.pathname === "\/api\/agent\/d173\/reporter-online"/);
  assert.match(worker, /await requireAgentUser\(request, env, \["ADMIN", "PICKPACK_ADMIN"\]\)/);
  assert.doesNotMatch(readModel.split("function agentReporterPresence")[1].split("function realtimePresence")[0], /storage\.sql\.exec|fetch\(|setInterval|put\(/);
});
test("Agent Reporter rows are actionless and never modify Picker transport count or contact targets", () => {
  assert.match(agent, /private List<ReporterOnlineView> _d173ReporterOnline/);
  assert.match(agent, /row\.Tag = reporter/);
  assert.match(agent, /cell\.UseColumnTextForButtonValue = false/);
  assert.match(agent, /cell\.ReadOnly = true/);
  assert.match(agent, /_activePdaCountForRelay = _pickerOnlineSnapshot\.Count/);
  assert.match(agent, /var picker = _pickerOnlineGrid\.Rows\[e\.RowIndex\]\.Tag as PickerPresenceView;/);
  assert.match(agent, /cadence=EXISTING_5M/);
  assert.match(client, /AUTHENTICATED_REALTIME_SOCKET/);
  assert.match(client, /AGENT_SESSION_REQUIRED/);
  assert.doesNotMatch(client, /SetCall|KickUser|ResolveContact|revokeSession/);
});
test("Unresolved Reporter UI bugs collect bounded local telemetry only", () => {
  assert.match(telemetry, /private val reporterUiCounts/);
  assert.match(telemetry, /reporterUiCounts\.size >= 320/);
  assert.match(telemetry, /reporter_ui_groups/);
  assert.match(telemetry, /NOT_PROVIDER_BILLING/);
  assert.doesNotMatch(telemetry.split("internal fun recordReporterUi")[1].split("private var sdkOverflow")[0], /fetch\(|HttpURLConnection|Firestore|Thread\.sleep/);
});

test("Reporter-only selected rows never escalate to all-Picker group contact", () => {
  assert.match(groupContact, /selectedRows\.Count > 0 && selected\.Count == 0/);
  assert.match(groupContact, /Reporter chỉ xem, không thuộc danh sách liên hệ Picker/);
  assert.match(groupContact, /\.Select\(r => r\.Tag as PickerPresenceView\)/);
  assert.match(groupContact, /if \(selectedRows\.Count > 0 && selected\.Count == 0\)[\s\S]{0,260}return;/);
});

test("standby Reporter roster uses an existing UI tick and prevents stale or duplicate background fetch", () => {
  assert.match(agent, /RefreshD173ReporterIfDue\(primary\)/);
  assert.match(agent, /primary \? TimeSpan\.FromMinutes\(5\) : TimeSpan\.FromMinutes\(10\)/);
  assert.match(agent, /Interlocked\.CompareExchange\(ref _d173ReporterRefreshRunning, 1, 0\)/);
  assert.match(agent, /string\.Equals\(current\.IdToken, session\.IdToken, StringComparison\.Ordinal\)/);
  assert.match(agent, /UpdateD173ReporterOnline\(new List<ReporterOnlineView>\(\)\)/);
});

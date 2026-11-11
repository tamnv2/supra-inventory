import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (name) => readFileSync(name, 'utf8');
const form = source('relay-agent/Program.cs');
const reset = source('relay-agent/D173E196BrowserSession.cs');
const browser = source('relay-agent/SupraConfirmBrowser.cs');
const host = source('relay-agent-webview2-host/Program.cs');
const probe = source('relay-agent/D173E196WebVisualProbe.cs');
const roster = source('relay-agent/D119AgentFeatures.cs');
const sku = source('relay-agent/D167SkuCoordinator.cs');
const webMonitor = source('relay-agent/D173E141VpsWebMonitor.cs');
const targeted = source('relay-agent/D157AgentFeatures.cs');

test('reset button is part of embedded Agent Web toolbar, never desktop', () => {
  assert.match(form, /InitE196BrowserSessionButton\(\)/);
  assert.match(form, /_wmsWebToolbar\.Resize \+=/);
  assert.match(reset, /_wmsWebToolbar\.Controls\.Add\(_e196ClearBrowserSession\)/);
  assert.match(reset, /_e196ClearBrowserSession\.Text = "Xoá phiên"/);
  assert.match(reset, /_supraBrowser\.IsDesktopSelected\(\)/);
  assert.match(reset, /MessageBoxDefaultButton\.Button2/);
  assert.match(reset, /VerifyCurrentAgentPasswordForBrowserAction\(/);
  assert.match(form, /_mainTabs\.SelectedTab = _wmsWebTab/);
  assert.match(form, /TryEmbedAgentWindow\(/);
});
test('browser reset fails closed against business work, deletes exact WMS-owned profile only', () => {
  for (const guard of [
    '_manualPicklistOperationRunning', '_d167AutomaticConfirmRunning',
    '_d157SessionValidationRunning', '_readinessRefreshRunning',
    '_browserStorageMigrationRunning', 'HasActiveWork'
  ]) assert.ok(reset.includes(guard), 'missing busy guard '+guard);
  assert.match(sku, /internal bool HasActiveWork/);
  assert.match(form, /_e196BrowserResetRunning.*== 0/);
  assert.match(browser, /ResetOwnedAgentWmsProfile\(\)/);
  assert.match(browser, /Path\.Combine\(root, "webview2-fixed-profile"\)/);
  assert.match(browser, /AGENT_HOST_STILL_RUNNING/);
  assert.match(browser, /PROFILE_CHILD_REPARSE_POINT/);
  assert.match(browser, /Directory\.Delete\(profile, true\)/);
  assert.doesNotMatch(browser, /Directory\.Delete\(AgentBrowserStorage\.CurrentRoot, true\)/);
  assert.doesNotMatch(reset, /ClearStoredSession\(\)|StopLeaderCoordination\(\)|LogoutAgent\(\)/);
  assert.match(reset, /_supraBrowser\.OpenAgentBackground\(\)/);
});
test('Web diagnostic covers actual visible pixels and async host callback without storing pages', () => {
  assert.match(form, /D173E196ScheduleVisualProbe\("TAB_ACTIVATED"\)/);
  assert.match(probe, /Graphics\.FromImage\(image\)/);
  assert.match(probe, /CopyFromScreen/);
  assert.match(probe, /DateTime\.UtcNow - _e196LastVisualProbeAtUtc < TimeSpan\.FromMinutes\(2\)/);
  assert.match(probe, /SCREEN_NEAR_WHITE/);
  assert.match(probe, /E196PaintCallbackState\(\)/);
  assert.match(browser, /0x8000u \+ 0x343u/);
  assert.match(host, /internal const int PresentationStatusMessage = 0x8000 \+ 0x343/);
  assert.match(host, /_e196PresentationStatus = 6/);
  assert.match(host, /_e196PresentationStatus = 3/);
  assert.match(probe, /source=SCREEN_NO_IMAGE_STORED/);
  assert.doesNotMatch(probe, /Save\(|Upload\(|WriteAllBytes\(|\.ToBase64String\(/);
  assert.match(probe, /foregroundRoot != Handle/);
});
test('primary selection label consistent without changing CAS business authority', () => {
  assert.match(roster, /_d150PrimaryTakeoverButton\.Text = "Chọn Agent chính"/);
  assert.match(targeted, /ok\.Text = "Chọn Agent chính"/);
  assert.match(roster, /PromoteManualPrimary\(\)/);
  assert.match(roster, /BeginD157TargetedPrimaryHandoff\(\)/);
});
test('remote Agent action observable from UI to Firestore hint and one-time claim, no new poll', () => {
  assert.match(roster, /D173_E196_AGENT_REMOTE_CLICK state=PRESSED/);
  assert.match(roster, /D173_E196_AGENT_REMOTE_ISSUE result=/);
  assert.match(roster, /D173_E196_AGENT_REMOTE_HINT result=ACCEPTED/);
  assert.match(roster, /D173_E196_AGENT_REMOTE_CLAIM result=/);
  assert.match(roster, /_e196RemoteRetried/);
  assert.match(roster, /_e196RemoteHintExpiry/);
  assert.match(roster, /"\/api\/agent\/remote-control\/issue"/);
  assert.match(roster, /"\/api\/agent\/remote-control\/claim"/);
  assert.match(roster, /"LOGOUT_USER" && action != "EXIT_AGENT"/);
});
test('bounded roster optimization preserves typed action model and RBAC', () => {
  assert.match(roster, /_e196RosterRowLookup = new Dictionary<string, DataGridViewRow>/);
  assert.match(roster, /_e196RosterRowLookup\.TryGetValue\(key, out row\)/);
  assert.match(roster, /row\.Tag = model;/);
  assert.match(roster, /_e196RosterRowLookup = null/);
  assert.match(roster, /D173_E196_ROSTER_PERF/);
  assert.match(webMonitor, /if \(layoutChanged\) LayoutE143WebToolbar\(\)/);
});

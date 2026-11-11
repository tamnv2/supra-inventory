import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const roster = read('relay-agent/D119AgentFeatures.cs');
const layout = read('relay-agent/D173E179OverviewNoScroll.cs');
const resources = read('relay-agent/D173DesktopResources.cs');
const form = read('relay-agent/Program.cs');
const theme = read('relay-agent/D173E036Theme.cs');
const reset = read('relay-agent/D173E196BrowserSession.cs');
const browser = read('relay-agent/SupraConfirmBrowser.cs');
const notices = read('relay-agent/D173E199RosterNotices.cs');
const worker = read('service/src/index.ts');

test('primary action and five channel filters use correct names and separate theme surfaces', () => {
  assert.match(resources, /_d150PrimaryTakeoverButton\.Text = "Chọn Agent chính"/);
  assert.doesNotMatch(resources, /_d150PrimaryTakeoverButton\.Text = compact \?/);
  assert.match(theme, /text\.StartsWith\("Chọn Agent chính"/);
  assert.match(roster, /"ALL", "AGENT", "WEB", "PDA_PICKER", "PDA_REPORTER"/);
  assert.match(roster, /Color\.FromArgb\(36, 72, 95\)/);
  assert.match(roster, /Color\.FromArgb\(210, 233, 242\)/);
  assert.match(roster, /selected \? selectedBackground/);
  assert.match(roster, /Color\.FromArgb\(44, 104, 137\)/);
  assert.match(roster, /Color\.FromArgb\(147, 205, 230\)/);
  assert.match(roster, /dialog\.BackColor = palette\.Window/);
  assert.match(roster, /dialog\.ForeColor = palette\.Text/);
  assert.match(form, /_browserBundleDownload = new D173ReadableDisabledButton\(\)/);
  assert.match(resources, /internal sealed class D173ReadableDisabledButton : Button/);
  assert.match(theme, /ReferenceEquals\(button, _browserBundleDownload\) && !button.Enabled/);
});

test('live header status only resizes fleet when actual line height changes', () => {
  assert.match(layout, /var previousHeight = -1/);
  assert.match(layout, /if \(height == previousHeight\) return/);
  assert.match(layout, /previousHeight = height;\s*D173E179FitAgentFleet\(agent\)/);
  assert.doesNotMatch(layout, /label\.TextChanged \+= \(s, e\) => D173E179FitAgentFleet\(agent\)/);
  assert.match(resources, /_trayMonitorTimer\.Interval = 1000/);
});

test('operation outcomes are visible near roster bottom-right with max 5 notices and 5 second expiry', () => {
  assert.match(roster, /InitE199RosterNotices\(pickerCard\)/);
  assert.match(roster, /Ui\(\(\) => NotifyD173RosterResult\(ok/);
  assert.match(roster, /Ui\(\(\) => NotifyD173RosterResult\(succeeded/);
  assert.match(notices, /_e199Notices\.Count == 5/);
  assert.match(notices, /_e199Notices\.RemoveAt\(0\)/);
  assert.match(notices, /DateTime\.UtcNow\.AddSeconds\(5\)/);
  assert.match(notices, /_e199NoticeTimer\.Stop\(\)/);
  assert.match(notices, /if \(expired \|\| visibilityChanged\) LayoutE199RosterNotices\(\)/);
  assert.match(notices, /_pickerOnlineGrid\.Right - width - 8/);
  assert.match(notices, /_pickerOnlineGrid\.Bottom - height - 8/);
  assert.doesNotMatch(notices, /Firebase|Firestore|HttpClient|PostJson/);
});

test('invalid remote-control parameters never bypass server role or one-time-password checks', () => {
  assert.match(roster, /D173_E199_AGENT_REMOTE_INPUT result=DENIED/);
  assert.match(roster, /validTarget = System\.Text\.RegularExpressions\.Regex\.IsMatch/);
  assert.match(roster, /validUser = System\.Text\.RegularExpressions\.Regex\.IsMatch/);
  assert.match(roster, /if \(!validTarget \|\| !validUser \|\| !validAction\)/);
  assert.match(roster, /"target_agent_user_id", agent\.AdminUserId/);
  assert.match(worker, /"INVALID_AGENT_CONTROL"/);
  assert.match(worker, /verifyAgentControlProof/);
  assert.doesNotMatch(roster, /_e185RemoteAgentHandled\.Clear\(\)/);
});

test('locked WMS profile retry is bounded to verified Agent-owned directory', () => {
  assert.match(reset, /E196BrowserIdle\(\)/);
  assert.match(browser, /Path\.Combine\(root, "webview2-fixed-profile"\)/);
  assert.match(browser, /PROFILE_CHILD_REPARSE_POINT/);
  assert.match(browser, /attempt < 6 && Directory\.Exists\(profile\)/);
  assert.match(browser, /catch \(UnauthorizedAccessException\) when \(attempt < 5\)/);
  assert.match(browser, /catch \(IOException\) when \(attempt < 5\)/);
  assert.match(browser, /PROFILE_CLEAR_INCOMPLETE/);
  assert.doesNotMatch(browser, /Directory\.Delete\(root, true\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(path, 'utf8');
const layout = source('relay-agent/D173E179OverviewNoScroll.cs');
const legacy = source('relay-agent/D173DesktopResources.cs');
const form = source('relay-agent/Program.cs');
const auth = source('relay-agent/D119AgentFeatures.cs');
const section = (start, end) => layout.slice(layout.indexOf(start), layout.indexOf(end, layout.indexOf(start)));
const overview = section('private void InstallD173E179NoScrollTop(', '// E182 FIELD FAIL:');
const toolbar = section('private int D173E182FitAgentHeader(', 'private void InstallD173E179WebTools(');

test('overview is exactly two 60/40 columns with the existing lower roster untouched', () => {
  assert.match(overview, /new ColumnStyle\(SizeType\.Percent, 60F\)/);
  assert.match(overview, /new ColumnStyle\(SizeType\.Percent, 40F\)/);
  assert.match(overview, /twoColumns\.ColumnCount = 2;/);
  assert.match(overview, /overview\.RowStyles\[0\]\.Height = 40F/);
  assert.match(overview, /overview\.RowStyles\[1\]\.Height = 60F/);
  assert.match(overview, /new RowStyle\(SizeType\.Percent, 65F\)/);
  assert.match(overview, /new RowStyle\(SizeType\.Percent, 35F\)/);
  assert.match(overview, /middle\.Controls\.Add\(agent, 0, 0\)/);
  assert.match(overview, /middle\.Controls\.Add\(picklist, 0, 1\)/);
  assert.match(overview, /twoColumns\.Controls\.Add\(desktop, 1, 0\)/);
  assert.match(overview, /InstallD173E179PickListPager\(picklist\)/);
});

test('old Supra summary and Desktop Web button disappear without removing WMS handlers', () => {
  assert.match(overview, /middle\.Controls\.Remove\(supra\);/);
  assert.match(overview, /supra\.Visible = false;/);
  assert.match(overview, /_wmsDesktop\.Visible = false;/);
  assert.doesNotMatch(overview, /webTab\.Controls\.Add\(supra\)/);
  assert.match(form, /OpenSupraConfirmBrowser\(false\)/);
  assert.match(form, /ActivateEmbeddedWmsTab\(\)/);
});

test('Agent toolbar always places five control actions before three visually distinct Web-data actions', () => {
  const items = ['_d150PrimaryTakeoverButton', '_manualUpdate', '_background',
    '_logout', '_agentExit', '_browserBundleDownload', '_openAgentDataFolder',
    '_moveAgentDataFolder'];
  const sequence = toolbar.slice(toolbar.indexOf('var actions = new Control[]'), toolbar.indexOf('}.Where(control'));
  let last = -1;
  for (const item of items) {
    const index = sequence.indexOf(item);
    assert.ok(index > last, item + ' is out of order');
    last = index;
  }
  assert.match(toolbar, /_d150PrimaryTakeoverButton\.Text = "Chuyển Agent chính"/);
  assert.match(toolbar, /_logout\.Text = "Đăng xuất"/);
  assert.match(toolbar, /SetD173BoundsIfChanged\(control, actionX, actionTop/);
  assert.match(legacy, /if \(_d173E182AdaptiveTopReady\) return;/);
  assert.match(overview, /button\.BackColor = Color\.FromArgb\(226, 237, 248\)/);
});

test('same Web-data controls retain their original handlers and auth-aware download state', () => {
  for (const item of ['_browserBundleDownload', '_openAgentDataFolder',
    '_moveAgentDataFolder']) {
    assert.match(overview, new RegExp('agent\\.Controls\\.Add\\(button\\)'));
    assert.match(auth, new RegExp(item + '\\.Visible = authenticated;'));
  }
  assert.match(form, /_browserBundleDownload\.Click \+= \(sender, e\) => StartAgentBrowserDownload\(\)/);
  assert.match(form, /_openAgentDataFolder\.Click \+= \(sender, e\) => OpenAgentDataFolder\(\)/);
  assert.match(form, /_moveAgentDataFolder\.Click \+= \(sender, e\) => ChooseAndMoveAgentBrowserData\(\)/);
  assert.match(form, /if \(status\.Ready\)[\s\S]*?_browserBundleDownload\.Enabled = false/);
  assert.match(form, /_browserBundleDownload\.Enabled = HasAgentSession\(\)/);
  assert.match(form, /_browserBundleDownload\.Text = "Tải Web Agent";/);
});

test('narrow desktop preserves tab access to Agent, PickList and resources without old Web summary', () => {
  assert.match(overview, /new TabPage\("Agent"\)/);
  assert.match(overview, /new TabPage\("PickList"\)/);
  assert.match(overview, /new TabPage\("Tài nguyên"\)/);
  assert.doesNotMatch(overview, /new TabPage\("Web"\)/);
  assert.match(overview, /agentTab\.Controls\.Add\(agent\)/);
  assert.match(overview, /pickTab\.Controls\.Add\(picklist\)/);
  assert.match(overview, /desktopTab\.Controls\.Add\(desktop\)/);
});

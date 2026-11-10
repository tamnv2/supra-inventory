import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const form = read('relay-agent/Program.cs');
const roster = read('relay-agent/D119AgentFeatures.cs');
const native = read('relay-agent/D173E179OverviewNoScroll.cs');
const desktop = read('relay-agent/D173DesktopResources.cs');
const sidebar = read('relay-agent/D173E038Sidebar.cs');

test('Owner E179: upper and roster each always own 50 percent', () => {
  assert.match(native, /overview\.RowStyles\[0\]\.Height = 50F;/);
  assert.match(native, /overview\.RowStyles\[1\]\.Height = 50F;/);
  assert.match(form, /InstallD173E179NoScrollTop\(overviewLayout,/);
  assert.doesNotMatch(form, /RowStyle\(SizeType\.Percent, 60F\)\);\s*overviewLayout\.RowStyles\.Add\(new RowStyle\(SizeType\.Percent, 40F\)/);
});

test('Owner E179: no vertical or horizontal scroll in upper operation region', () => {
  assert.match(native, /viewport\.AutoScroll = false;/);
  assert.match(native, /threeColumns\.AutoScroll = false;/);
  assert.match(native, /_agentFleetGrid\.ScrollBars = ScrollBars\.None;/);
  assert.match(native, /_manualPicklistGrid\.ScrollBars = ScrollBars\.None;/);
  assert.match(form, /agentCard\.AutoScroll = false;/);
  assert.match(form, /_supraCard\.AutoScroll = false;/);
  assert.match(form, /directCard\.AutoScroll = false;/);
  assert.match(native, /new TabControl/);
  assert.match(native, /viewport\.ClientSize\.Width >= 980/);
  assert.doesNotMatch(form, /mode == 2 \? 725/);
});

test('Owner E179: only lower session roster may scroll vertically', () => {
  assert.match(roster, /_pickerOnlineGrid\.ScrollBars = ScrollBars\.Vertical;/);
  assert.match(roster, /_d173RosterToolbar\.AutoScroll = false;/);
  assert.match(roster, /D173E179FitRosterColumns\(\);/);
  assert.match(native, /grid\.ScrollBars = ScrollBars\.Vertical;/);
  assert.match(roster, /private void LayoutD173RosterToolbar\(\)/);
});

test('Owner E179: preserve existing commands, browser, local metric stream and sidebar', () => {
  for (const command of ['_manualPicklistSearch', '_manualPicklistConfirmAll', '_agentExit',
    '_wmsCapture', '_wmsDesktop', '_agentFleetGrid']) {
    assert.ok(form.includes(command), command);
  }
  assert.match(native, /TestSupraBrowser\(\)/);
  assert.match(native, /StartAgentBrowserDownload\(\)/);
  assert.match(native, /ChooseAndMoveAgentBrowserData\(\)/);
  assert.match(desktop, /CreateD173DesktopCard/);
  assert.match(desktop, /_d173RefreshSelector/);
  assert.match(sidebar, /InstallD173E038Sidebar/);
});

test('Agent-only release, no Worker, D172, Android or Web change implied', () => {
  assert.equal(read('relay-agent/VERSION').trim(), '178');
  assert.match(read('relay-agent/AgentConfig.cs'), /AgentBuild = 178;/);
  assert.match(read('relay-agent/SupraInventoryRelayAgent.csproj'), /<FileVersion>0\.178\.0\.0<\/FileVersion>/);
});

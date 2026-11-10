import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(p, 'utf8');
const form = read('relay-agent/Program.cs');
const layout = read('relay-agent/D173E179OverviewNoScroll.cs');
const roster = read('relay-agent/D119AgentFeatures.cs');
const presence = read('relay-agent/D173ReporterPresence.cs');
const auth = JSON.parse(read('ops/d173-e181-agent179-release-authorization.json'));
const historicalE181 = read('relay-agent/VERSION').trim() === '179';

test('E181 Agent179 version, Owner signed-only and independent D172', { skip: !historicalE181 }, () => {
  assert.equal(read('relay-agent/VERSION').trim(), '179');
  assert.match(read('relay-agent/AgentConfig.cs'), /AgentBuild = 179;/);
  assert.match(read('relay-agent/SupraInventoryRelayAgent.csproj'), /<AssemblyVersion>0\.179\.0\.0<\/AssemblyVersion>/);
  assert.equal(auth.owner_code_approved, true);
  assert.equal(auth.owner_protected_release_approved, true);
  assert.deepEqual(auth.approved_components, ['agent']);
  for (const key of ['d172_mutation', 'stable_mutation', 'service_mutation', 'web_mutation', 'android_mutation', 'worker_mutation', 'firestore_mutation'])
    assert.equal(auth[key], false);
});
test('40% operations and 60% session roster with no whole-page scroll', { skip: !historicalE181 }, () => {
  assert.match(form, /overviewLayout\.RowStyles\.Add\(new RowStyle\(SizeType.Percent, 40F\)\);\s*overviewLayout\.RowStyles\.Add\(new RowStyle\(SizeType.Percent, 60F\)\);/);
  assert.match(layout, /overview.RowStyles\[0\].Height = 40F;/);
  assert.match(layout, /overview.RowStyles\[1\].Height = 60F;/);
  for (const token of ['viewport.AutoScroll = false;', 'threeColumns.AutoScroll = false;', '_agentFleetGrid.ScrollBars = ScrollBars.None;', '_manualPicklistGrid.ScrollBars = ScrollBars.None;', 'grid.ScrollBars = ScrollBars.Vertical;'])
    assert.ok(layout.includes(token), token);
  assert.match(roster, /_d173RosterToolbar.AutoScroll = false;/);
});
test('Agent177 all six fleet columns remain available', { skip: !historicalE181 }, () => {
  for (const name of ['Admin', 'Machine', 'Role', 'Supra', 'Version', 'LastSeen'])
    assert.ok(layout.includes('"' + name + '"'), name);
  assert.match(layout, /col.Visible = true;/);
  assert.match(layout, /_d173E179FleetHint.Visible = false;/);
});
test('Agent177 original Web controls remain visible, no replacement menu', { skip: !historicalE181 }, () => {
  for (const control of ['_wmsCapture','_wmsDesktop','_wmsTest','_browserBundleDownload','_openAgentDataFolder','_moveAgentDataFolder','_browserBundleProgress'])
    assert.ok(layout.includes(control), control);
  assert.doesNotMatch(layout, /InstallD173E179WebTools\(supra\);/);
  assert.match(layout, /buttons\[i\].Visible = true;/);
});
test('Roster keeps all business fields, no horizontal scrolling', { skip: !historicalE181 }, () => {
  for (const name of ['D173SummaryIdentity','D173SummaryClient','D173SummaryTime','D173SummaryActivity','D173SummaryState','KickUser','CallSpecialist','ResolveContact'])
    assert.ok(layout.includes('"' + name + '"'), name);
  assert.match(layout, /var showColumn = name != "D173SummaryTech" \|\| tech;/);
  assert.match(layout, /grid.ScrollBars = ScrollBars.Vertical;/);
});
test('Web online/offline uses verified connection rather than login', { skip: !historicalE181 }, () => {
  assert.match(presence, /internal bool HasConnectionEvidence;/);
  assert.match(presence, /var hasEvidence = schema == 1 \|\| row.ContainsKey\("connected"\);/);
  assert.match(presence, /var connected = schema == 1 \|\|/);
  assert.match(roster, /Online · WebSocket kết nối/);
  assert.match(roster, /Offline · WebSocket đã ngắt/);
  assert.match(roster, /Chưa xác định · thiếu dữ liệu kết nối/);
  assert.match(roster, /Web · Online /);
  assert.match(roster, /Web · chưa xác định/);
  assert.match(roster, /reporter.HasConnectionEvidence/);
});
test('Existing 5-minute roster fetch, no extra provider work', { skip: !historicalE181 }, () => {
  assert.match(roster, /cadence=EXISTING_5M/);
  assert.match(roster, /private void UpdateD173ReporterOnline\(/);
  assert.match(presence, /\/api\/agent\/d173\/reporter-online/);
  assert.equal(auth.no_new_provider_requests, true);
});

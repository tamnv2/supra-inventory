import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('D173 Reporter app versions use existing authenticated realtime', () => {
  const ticket = read('service/src/read-api.ts');
  const core = read('service/src/read-model-core.ts');
  const client = read('relay-agent/D173ReporterPresence.cs');
  const agent = read('relay-agent/D119AgentFeatures.cs');
  assert.match(ticket, /INVALID_APP_VERSION/);
  assert.match(core, /android_version:/);
  assert.match(core, /web_version:/);
  assert.match(client, /internal string AppVersion/);
  assert.match(agent, /reporter.AppVersion/);
  assert.match(agent, /row.Tag = reporter/);
  assert.match(agent, /cell.ReadOnly = true/);
});
test('Reporter count badges use existing counters and delta', () => {
  const source = read('android/app/src/main/java/cd/cc/supra/inventory/beta/ReporterController.kt');
  const ui = read('android/app/src/main/res/layout/view_invent.xml');
  for (const key of ['Pending','Overdue','HasStock','Skip']) {
    assert.ok(source.includes('R.id.badgeReporter' + key), key);
    assert.ok(ui.includes('@+id/badgeReporter' + key), key);
  }
  assert.match(source, /recentCounts\.hasStock/);
  assert.match(source, /recentCounts\.skipAllowed/);
  assert.match(ui, /bg_d173_badge_yellow/);
  assert.match(ui, /bg_d173_badge_red/);
  assert.doesNotMatch(source, /Timer\s*\(/);
});
test('Picker result card stays manual with local DISPLAYED and ACK semantics', () => {
  const service=read('android/app/src/main/java/cd/cc/supra/inventory/beta/CriticalOverlayService.kt');
  const layout=read('android/app/src/main/res/layout/overlay_alert.xml');
  assert.match(layout, /overlayCard/);
  assert.match(layout, /layout_gravity="center"/);
  assert.match(layout, /overlayMessageScroll/);
  assert.match(layout, /btnOverlayAck/);
  assert.match(service, /finishActive\(userAcknowledged = true\)/);
  assert.match(service, /recordDisplayedAfterDraw/);
});
test('Agent resources are local and protected PickList persists', () => {
  const monitor=read('relay-agent/D173DesktopResources.cs');
  const program=read('relay-agent/Program.cs');
  const project=read('relay-agent/SupraInventoryRelayAgent.csproj');
  assert.match(project, /PackageReference Include="AntdUI" Version="2\.4\.16"/);
  // E047 deliberately uses the exact shared card primitive for border parity.
  assert.match(monitor, /var panel = NewCard\(0, 0, 400, 320\)/);
  assert.match(monitor, /ApplyD173DesktopMetrics\(SystemMetrics value\)/);
  assert.doesNotMatch(monitor,/HttpClient|Firestore|WebRequest|Sqlite|WmsConfirm/);
  assert.match(program, /CreateD173DesktopCard\(\)/);
  assert.match(program, /directCard.MinimumSize = new Size\(0, 180\)/);
  assert.ok(monitor.includes('ApplyD173CompactAgentAuthLayout(Control host, bool authenticated)'));
  assert.ok(monitor.includes('_pair.SetBounds(12, 108, 92, 30)'));
  assert.ok(read('relay-agent/D119AgentFeatures.cs').includes('ApplyD173CompactAgentAuthLayout(host, authenticated)'));
});
test('Tabler role-preserving collapsible sidebar restored after E043 Web UI rollback', () => {
  const pkg=JSON.parse(read('web/package.json'));
  const ui=read('web/src/operational-app.ts');
  const css=read('web/src/d173-tabler.css');
  assert.equal(pkg.dependencies['@tabler/core'],'1.6.1');
  assert.equal(pkg.version,'3.3.2');
  assert.match(ui,/d173-tabler-sidebar/);
  assert.match(ui,/canAccessSection/);
  assert.match(ui,/localStorage\.setItem\("d173:sidebar-compact"/);
  assert.match(ui,/import "@tabler\/core\/dist\/css\/tabler\.min\.css"/);
  assert.match(css,/@media \(max-width: 780px\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('E047 Agent-Supra-PickList column and stack order preserved on reflow', () => {
  const p = read('relay-agent/Program.cs');
  assert.match(p, /overviewLayout\.Controls\.Add\(agentCard, 0, 0\)/);
  assert.match(p, /d173MiddleStack\.Controls\.Add\(_supraCard, 0, 0\)/);
  assert.match(p, /d173MiddleStack\.Controls\.Add\(directCard, 0, 1\)/);
  assert.match(p, /overviewLayout\.Controls\.Add\(d173MiddleStack, 1, 0\)/);
  assert.doesNotMatch(p, /d173SystemStack/);
  assert.match(p, /SizeChanged \+= \(sender, args\) => reflowD173\(\)/);
  assert.match(p, /InitializeD119AgentFeatures\(overviewLayout\)/);
});

test('E047 Desktop has shared Sample2 card border and two isolated network graphs', () => {
  const p = read('relay-agent/D173DesktopResources.cs');
  assert.match(p, /var panel = NewCard\(0, 0, 400, 320\)/);
  assert.match(p, /SetStyle\(ControlStyles\.AllPaintingInWmPaint/);
  assert.match(p, /NetworkPair = true/);
  assert.match(p, /PushNetwork\(Math\.Max\(0, value\.NetworkDownMbps\)/);
  assert.match(p, /Math\.Max\(0, value\.NetworkUpMbps\)\)/);
  assert.match(p, /new Pen\(uploadAccent, 2f\)/);
  assert.doesNotMatch(p, /NetworkDownMbps\) \+\s*Math\.Max\(0, value\.NetworkUpMbps/);
  for (const forbidden of ['HttpClient', 'GetAsync', 'SendJson', 'FirebaseDatabase'])
    assert.ok(!p.includes(forbidden), 'local resource monitoring must not perform provider calls');
});

test('E047 window never restores to ordinary frame; tray and WMS controls retained', () => {
  const p = read('relay-agent/Program.cs');
  assert.match(p, /protected override void WndProc\(ref Message message\)/);
  assert.match(p, /command == 0xF120/);
  assert.match(p, /message.Msg == 0x00A3/);
  assert.match(p, /protected override void OnResize\(EventArgs e\)/);
  assert.match(p, /MinimizeToTray\(\)/);
  assert.match(p, /RestoreFromTray\(\)/);
  assert.match(p, /ActivateEmbeddedWmsTab\(\)/);
  assert.equal(read('relay-agent/VERSION').trim(), '146');
  assert.match(read('relay-agent/AgentConfig.cs'), /AgentBuild = 146/);
  assert.match(read('relay-agent/SupraInventoryRelayAgent.csproj'), /0\.146\.0\.0/);
});

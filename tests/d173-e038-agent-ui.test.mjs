import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('E038 owner Sample2 native sidebar preserves WMS/role-bound tabs',()=>{
 const program=read('relay-agent/Program.cs'), nav=read('relay-agent/D173E038Sidebar.cs');
 assert.match(program,/InstallD173E038Sidebar\(tabShell\)/);
 assert.match(program,/overviewLayout.Controls.Add\(directCard, 0, 0\)/);
 assert.match(program,/overviewLayout.Controls.Add\(d173SystemStack, 1, 0\)/);
 assert.ok(nav.includes('_mainTabs.TabPages.Contains(captured)'));
 assert.ok(nav.includes('_mainTabs.SelectedTab = captured'));
 for(const page of ['_overviewPage','_connectionPage','_d167SkuPage','_wmsWebTab'])
   assert.ok(program.includes('_mainTabs.TabPages.Add('+page+')'));
 assert.match(program,/MaximizeBox = false/);
 assert.match(program,/ApplyWorkingAreaMaximum\(\)/);
});
test('E038 source only local sampling and contrasting dark tables',()=>{
 const perf=read('relay-agent/D173DesktopResources.cs');
 const theme=read('relay-agent/D173E036Theme.cs');
 const cfg=read('relay-agent/D173PerformanceDetails.cs');
 const ops=read('relay-agent/D119AgentFeatures.cs');
 assert.ok(perf.includes('D173LocalSamplingInterval'));
 assert.ok(perf.includes('new[] { 1, 2, 5, 10 }'));
 assert.ok(perf.includes('_trayMonitorTimer.Interval = seconds * 1000'));
 assert.ok(perf.includes('DashStyle = DashStyle.Dot'));
 assert.match(theme,/RowsDefaultCellStyle.ForeColor/);
 assert.match(theme,/AlternatingRowsDefaultCellStyle.BackColor/);
 assert.match(ops,/Web\/App: không khả dụng/);
 assert.match(ops,/ApplyD173E038AgentToolbar/);
 assert.match(cfg,/_d173PerformanceRefresh.Interval = 5000/);
 for(const s of ['HttpClient','Firestore','Worker','GetAsync','SendJson'])
   assert.ok(!perf.includes(s),s);
});
test('E038 strictly versioned Agent-only Owner release gate',()=>{
 const approval=JSON.parse(read('ops/d173-e038-agent-release-authorization.json'));
 const script=read('tools/d173_e038_agent_release_gate.py');
 const wrapper=read('tools/d167_release_gate.py');
 assert.equal(read('relay-agent/VERSION').trim(),'144');
 assert.equal(approval.agent_target_version,144);
 assert.deepEqual(approval.approved_components,['agent']);
 assert.equal(approval.d172_lifecycle,'PENDING_HOLD');
 assert.equal(approval.stable_deploy_permission,false);
 assert.equal(approval.field_pass,false);
 assert.equal(approval.owner_pass,false);
 assert.ok(script.includes('GITHUB_REF'));
 assert.ok(script.includes('protected source or workflow drift'));
 assert.ok(wrapper.includes('D173-E038_AGENT_ONLY_RELEASE:'));
});

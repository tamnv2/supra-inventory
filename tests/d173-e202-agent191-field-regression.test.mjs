import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const form = read('relay-agent/Program.cs');
const presence = read('relay-agent/FirestoreAgentLeaderCoordinator.cs');
const roster = read('relay-agent/D119AgentFeatures.cs');
const worker = read('service/src/index.ts');

test('remote target comes from authenticated Agent session, not display email or machine', () => {
  assert.match(presence, /var value = \(session\.AppUserId \?\? ""\)\.Trim\(\)\.ToLowerInvariant\(\)/);
  assert.match(presence, /if \(value == "admin" \|\| value == "tamnv2" \|\| value == "vps"\) return value/);
  assert.match(presence, /value = \(session\.LoginName \?\? ""\)\.Trim\(\)\.ToLowerInvariant\(\)/);
  assert.match(roster, /IsD165OneTimeAgentLogin\(agent\.AdminUserId\) &&/);
  assert.match(roster, /D173_E202_AGENT_REMOTE_INPUT result=DENIED target_login_valid=false/);
  assert.match(roster, /var action = ShowE185RemoteAgentChoice/);
  assert.ok(roster.indexOf('target_login_valid=false') < roster.indexOf('var action = ShowE185RemoteAgentChoice'));
  assert.match(worker, /verifyAgentControlProof/);
  assert.match(worker, /target_agent_user_id/);
  assert.doesNotMatch(presence, /agent_admin_user_id", StringField\(Environment\.MachineName\)/);
});

test('one-second after-hours timer preserves clock/schedule but skips unchanged geometry reflow', () => {
  assert.match(form, /_afterHoursTimer\.Interval = 1000/);
  assert.match(form, /CheckAfterHoursSchedule\(\);[\s\S]*?RefreshD130ResourceClock\(\)/);
  assert.match(form, /if \(!visibilityChanged && geometry == _d173E202AfterHoursGeometry\) return/);
  assert.match(form, /_d173E202AfterHoursGeometry = geometry/);
  assert.match(form, /_d173E202AfterHoursGeometry = ""/);
  assert.match(form, /D173E179FitAgentFleet\(host\)/);
});

test('existing server proof and one-time target claim are not bypassed', () => {
  assert.match(roster, /"target_agent_user_id", agent\.AdminUserId/);
  assert.match(roster, /if \(!validTarget \|\| !validUser \|\| !validAction\)/);
  assert.match(roster, /"\/api\/agent\/remote-control\/claim"/);
  assert.match(worker, /"\/api\/agent\/remote-control\/claim"/);
});

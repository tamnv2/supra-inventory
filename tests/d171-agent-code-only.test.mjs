import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(p, "utf8");
const network = read("relay-agent/D168NetworkRoute.cs");
const program = read("relay-agent/Program.cs");
const grpc = read("relay-agent/FirestoreD157Realtime.cs");
const transport = read("relay-agent/FirestoreConfirmationTransport.cs");
const leader = read("relay-agent/FirestoreAgentLeaderCoordinator.cs");
const picker = read("android/app/src/main/java/cd/cc/supra/inventory/beta/RelayPocClient.kt");

test("network mode is epoch-cached and UNKNOWN on an uncertain transition", () => {
  assert.match(network, /_networkModeCacheUntilMs/);
  assert.match(network, /_cachedNetworkMode = "UNKNOWN"/);
  assert.match(network, /epoch == _networkModeEpoch/);
  assert.match(network, /internal static void NotifyNetworkChange\(\)/);
  assert.match(network, /\+ 5000/);
  assert.match(program, /D168NetworkRoute\.NotifyNetworkChange\(\)/);
});

test("existing gRPC streams are only re-bound once a Windows network transition is stable", () => {
  assert.match(program, /FirestoreD157Grpc\.NotifyNetworkChange\(\)/);
  assert.match(grpc, /Thread\.Sleep\(1250\)/);
  assert.match(grpc, /epoch != Volatile\.Read\(ref _networkEpoch\)/);
  assert.match(grpc, /RegisterActiveRoute\(routeCts\)/);
  assert.match(grpc, /UnregisterActiveRoute\(routeCts\)/);
  assert.match(grpc, /CancellationTokenSource\.CreateLinkedTokenSource\(token\)/);
  assert.match(grpc, /MoveNext\(routeCts\.Token\)/);
  assert.match(grpc, /NETWORK_EPOCH_RECONNECT/);
});

test("REST watchdog does not block fresh listener payload and has single-flight plus fencing", () => {
  assert.match(transport, /_pendingRestWatchdog == null/);
  assert.match(transport, /var watchdog = Task\.Run\(\(\) => ReadPendingDocuments\(session\)\)/);
  assert.match(transport, /completedWatchdog\.IsCompleted/);
  assert.match(transport, /_pendingRestOwnerUserId/);
  assert.match(transport, /_pendingRestOwnerGeneration/);
  assert.match(transport, /stale-rest-result=DROP/);
  assert.doesNotMatch(transport, /restTask\.GetAwaiter\(\)\.GetResult\(\)/);
  assert.match(transport, /var listenerCanonical = CanonicalizePendingDocuments/);
  assert.match(transport, /ProcessPendingDocuments\(session, restCanonical\)/);
});

test("existing durable PDA request and HA generation-CAS contracts are preserved", () => {
  assert.match(picker, /relay_poc_jobs/);
  assert.match(leader, /WritePrimaryLease\(session\)/);
  assert.match(leader, /HasFreshCommonPrimaryLease\(\)/);
  assert.match(transport, /MaxPendingAgeMs = 35000L/);
  assert.match(transport, /NormalPendingAgeMs = 20000L/);
});

test("v140 reserved for staged source and is not a published Agent v139 replacement", () => {
  assert.equal(read("relay-agent/VERSION").trim(), "140");
  assert.match(read("relay-agent/AgentConfig.cs"), /AgentBuild = 140/);
  assert.match(read("relay-agent/SupraInventoryRelayAgent.csproj"), /<AssemblyVersion>0\.140\.0\.0<\/AssemblyVersion>/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("../service/node_modules/typescript");
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const service = read("service/src/runtime-logs.ts");
const coreSource = read("service/src/runtime-logs-core.ts");
const agent = read("relay-agent/AgentLogUploadBridge.cs");

function getAgentResolver(sandbox) {
  const source = ts.createSourceFile("runtime-logs.ts", service, ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(node =>
    ts.isFunctionDeclaration(node) && node.name?.text === "resolveRuntimeLogDayForAgent");
  assert.ok(declaration, "Agent resolver is present");
  const isolated = declaration.getText(source).replace(/^export\s+/, "");
  const js = ts.transpileModule(isolated, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return vm.runInNewContext(js + "\nresolveRuntimeLogDayForAgent;", sandbox);
}

function harness(folderId, overrides = {}) {
  const stats = { reads: 0, oauthRefreshes: 0, provisions: 0 };
  const storage = new Map();
  const reader = {
    fetch: async url => {
      stats.reads++;
      assert.match(url, /^https:\/\/inventory-core\.internal\/runtime-logs\/day-folder\?/);
      return { ok: true, json: async () => ({ folder_id: folderId }) };
    },
  };
  const sandbox = {
    FILE_ID_RE: /^[A-Za-z0-9_-]{10,200}$/,
    dailyFolderCache: storage,
    DAILY_FOLDER_CACHE_MS: 300_000,
    vietnamDateKey: () => "2026-11-03",
    Date, encodeURIComponent,
    core: () => reader,
    refreshGoogleAccessToken: async () => { stats.oauthRefreshes++; return "test_oauth_value"; },
    resolveRuntimeLogDailyFolder: async (_env, token) => {
      stats.provisions++;
      assert.equal(token, "test_oauth_value");
      return { id: "provisionedcanonical98765", dateKey: "2026-11-03" };
    },
    ...overrides,
  };
  const resolve = getAgentResolver(sandbox);
  return { resolve, stats, env: { LOGS_FOLDER_ID: "existingrootfolder12345" } };
}

test("D173-E127: existing canonical Agent day does not depend on Worker Google OAuth", async () => {
  const h = harness("canonicaldayfolder123456", {
    refreshGoogleAccessToken: async () => { throw new Error("LOGS_OAUTH_FAILED:invalid_grant"); },
  });
  const result = await h.resolve(h.env);
  assert.deepEqual({ ...result }, { id: "canonicaldayfolder123456", dateKey: "2026-11-03" });
  assert.equal(h.stats.reads, 1);
  assert.equal(h.stats.provisions, 0);
  const result2 = await h.resolve(h.env);
  assert.equal(result2.id, "canonicaldayfolder123456");
  assert.equal(h.stats.reads, 1, "bounded same-day cache");
});

test("D173-E127: no canonical day retains single Worker-only provisioning with OAuth", async () => {
  const h = harness("");
  const result = await h.resolve(h.env);
  assert.equal(result.id, "provisionedcanonical98765");
  assert.equal(h.stats.reads, 1);
  assert.equal(h.stats.oauthRefreshes, 1);
  assert.equal(h.stats.provisions, 1);
});

test("D173-E127: unknown canonical day does not bypass an unavailable Worker OAuth", async () => {
  const h = harness("", {
    refreshGoogleAccessToken: async () => { throw new Error("LOGS_OAUTH_FAILED:invalid_grant"); },
  });
  await assert.rejects(() => h.resolve(h.env), /LOGS_OAUTH_FAILED:invalid_grant/);
  assert.equal(h.stats.provisions, 0, "never create a second Apps Script-owned day folder");
});

test("D173-E127: canonical day lookup is read-only, lease owns insertion", () => {
  const begin = coreSource.indexOf('if (url.pathname.startsWith("/runtime-logs/day-folder"))');
  const get = coreSource.indexOf('url.pathname === "/runtime-logs/day-folder")', begin);
  const lease = coreSource.indexOf('url.pathname === "/runtime-logs/day-folder/lease")', get);
  const insert = coreSource.indexOf("INSERT OR IGNORE INTO runtime_log_daily_folders", begin);
  const commit = coreSource.indexOf('url.pathname === "/runtime-logs/day-folder/commit")', lease);
  assert.ok(begin > 0 && get > begin && lease > get && insert > lease && commit > insert);
});

test("D173-E127: existing log retention and failure receipts remain guarded", () => {
  assert.match(service, /archive_status: "DEFERRED"/);
  assert.match(service, /archive_status: "DRIVE_SYNCED"/);
  assert.match(service, /retryBufferedRuntimeLogArchives/);
  assert.match(agent, /GATEWAY_REJECTED/);
  assert.match(agent, /File\.Delete\(path\)/);
  assert.match(service, /probeRuntimeLogArchiveDestination/);
  assert.match(coreSource, /\/runtime-logs\/archive-diagnostics/);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "../service/node_modules/typescript/lib/typescript.js";

const config = fs.readFileSync("service/wrangler.beta.toml", "utf8");
const patterns = JSON.parse(config.match(/^run_worker_first\s*=\s*(\[[^\n]+\])/m)?.[1] || "null");
assert.deepEqual(patterns, ["/*", "!/assets/*"]);
function workerFirst(path) {
  const pathname = new URL("https://inventory.supra.cc.cd" + path).pathname;
  let result = false;
  for (const pattern of patterns) {
    const negative = pattern.startsWith("!");
    const prefix = (negative ? pattern.slice(1) : pattern).replace(/\*$/, "");
    if (pathname.startsWith(prefix)) result = !negative;
  }
  return result;
}
for (const path of ["/", "/index.html", "/api/auth/me", "/api/reporter/queue", "/api/obpp1291/records",
  "/health", "/health/routine", "/downloads/pda/manifest", "/downloads/agent/latest",
  "/api/oauth/google/start", "/api/oauth/google/callback", "/about", "/privacy", "/terms",
  "/assets-other/file.js", "/assets/../api/auth/me"]) assert.equal(workerFirst(path), true, path);
for (const path of ["/assets/index-AbC123.js", "/assets/index-AbC123.css?version=1"]) assert.equal(workerFirst(path), false, path);

const noopModule = new Proxy({}, { get: () => () => null });
function load(path, imports = {}) {
  const exports = {};
  const compiled = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(compiled, { exports, require: name => imports[name] || noopModule,
    Request, Response, Headers, URL, URLSearchParams, Map, Set, TextEncoder, crypto, console, Date, fetch() { throw Error("no provider request allowed"); } });
  return exports;
}
const publicPages = load("service/src/public-pages.ts");
const internal = load("service/src/internal-d119.ts");
const worker = load("service/src/index.ts", { "./public-pages": publicPages, "./internal-d119": internal }).default;
for (const method of ["GET", "HEAD"]) {
  for (const extension of ["js", "css"]) {
    const req = new Request("https://inventory.supra.cc.cd/assets/index-AbC123." + extension, { method });
    const expected = new Response(method === "HEAD" ? null : new Uint8Array([0, 1, 127, 255]), {
      status: 200, headers: { "content-type": extension === "js" ? "text/javascript" : "text/css",
        "cache-control": "public, max-age=31536000, immutable", etag: '"fixture-content"' },
    });
    let assetCalls = 0;
    const actual = await worker.fetch(req, { APP_ENV: "beta", ASSETS: { fetch(got) { assert.equal(got, req); assetCalls++; return expected; } } },
      { waitUntil() { throw Error("static assets must not schedule business work"); } });
    assert.equal(actual, expected, "existing Worker returns the untouched ASSETS response");
    assert.equal(assetCalls, 1);
    assert.deepEqual([...actual.headers], [...expected.headers]);
    assert.deepEqual(new Uint8Array(await actual.clone().arrayBuffer()), new Uint8Array(await expected.clone().arrayBuffer()));
  }
}
for (const path of ["/about", "/privacy", "/terms"]) {
  const response = await worker.fetch(new Request("https://inventory.supra.cc.cd" + path), { APP_ENV: "beta" }, {});
  assert.equal(response.status, 200); assert.ok(response.headers.get("content-security-policy")?.includes("frame-ancestors 'none'"));
}
const healthCalls = [];
const healthEnv = { APP_ENV: "beta", PROJECT_KEY: "fixture", SOURCE_COMMIT: "fixture-source",
  FIREBASE_PROJECT_ID: "fixture-project", FIREBASE_WEB_API_KEY: "REDACTED-FIXTURE-ONLY",
  GOOGLE_RUNTIME_SA_JSON: "REDACTED-FIXTURE-ONLY", GOOGLE_DRIVE_OAUTH_CLIENT_ID: "REDACTED-FIXTURE-ONLY",
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET: "REDACTED-FIXTURE-ONLY", GOOGLE_DRIVE_OAUTH_REDIRECT_URI: "REDACTED-FIXTURE-ONLY",
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN: "REDACTED-FIXTURE-ONLY", ARCHIVE_SHEET_ID: "REDACTED-FIXTURE-ONLY", ARCHIVE_FOLDER_ID: "REDACTED-FIXTURE-ONLY",
  INVENTORY_CORE: { idFromName: () => "one", get: () => ({ async fetch(url) {
    healthCalls.push(new URL(url).pathname);
    assert.equal(new URL(url).pathname, "/health/routine", "routine monitor cannot read migration users/folders");
    return new Response(JSON.stringify({ status: "ok", schema_version: 17, expected_schema_version: 17, operational_v2: { ready: true } }));
  } }) } };
const healthy = await worker.fetch(new Request("https://inventory.supra.cc.cd/health/routine"), healthEnv, {});
assert.equal(healthy.status, 200); assert.deepEqual(healthCalls, ["/health/routine"]);
assert.equal((await healthy.json()).source_commit, "fixture-source");
healthCalls.length = 0;
const missingBinding = await worker.fetch(new Request("https://inventory.supra.cc.cd/health/routine"), { ...healthEnv, GOOGLE_RUNTIME_SA_JSON: "" }, {});
assert.equal(missingBinding.status, 503); assert.deepEqual(healthCalls, ["/health/routine"]);
console.log("D173_E108_ASSETS_PASS: public bundles byte/header identical, sensitive routing preserved, routine health fresh one-DO/no migration with fail-closed bindings");

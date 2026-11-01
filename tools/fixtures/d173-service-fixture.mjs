import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import ts from "../../service/node_modules/typescript/lib/typescript.js";

const modules = new Map();
export function loadServiceModule(path) {
  path = resolve(path.endsWith(".ts") ? path : path + ".ts");
  if (modules.has(path)) return modules.get(path).exports;
  const module = { exports: {} };
  modules.set(path, module);
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }}).outputText;
  new Function("require", "module", "exports", code)(specifier => {
    assert.ok(specifier.startsWith("."), "fixture only loads local service modules");
    return loadServiceModule(resolve(dirname(path), specifier));
  }, module, module.exports);
  return module.exports;
}

export async function createServiceFixture(env = {}) {
  const db = new DatabaseSync(":memory:");
  const statements = [], kv = new Map(), sockets = [];
  let savepoint = 0;
  const state = {
    storage: {
      sql: { exec(sql, ...bindings) {
        statements.push(sql);
        let rows;
        if (!bindings.length && /^\s*(?:CREATE|ALTER|DROP|PRAGMA foreign_keys)/i.test(sql)) {
          db.exec(sql); rows = [];
        } else rows = db.prepare(sql).all(...bindings).map(row => ({ ...row }));
        return { toArray: () => rows, one: () => rows[0], rowsRead: rows.length,
          rowsWritten: /^\s*(?:INSERT|UPDATE|DELETE)/i.test(sql) ? 1 : 0,
          *[Symbol.iterator]() { yield* rows; } };
      }},
      transactionSync(fn) {
        const name = "fixture_" + ++savepoint;
        db.exec("SAVEPOINT " + name);
        try { const result = fn(); db.exec("RELEASE " + name); return result; }
        catch (error) { db.exec("ROLLBACK TO " + name); db.exec("RELEASE " + name); throw error; }
      },
      async get(key) { return kv.get(key); }, async put(key, value) { kv.set(key, value); },
      async delete(key) { if (Array.isArray(key)) return key.reduce((n, item) => n + Number(kv.delete(item)), 0); return kv.delete(key); },
      async list({ prefix = "" } = {}) { return new Map([...kv].filter(([key]) => key.startsWith(prefix))); },
      async setAlarm() {}, async deleteAlarm() {},
    },
    tasks: [], blockConcurrencyWhile(fn) { const task = fn(); this.tasks.push(task); return task; },
    getWebSockets() { return sockets; }, waitUntil(promise) { this.tasks.push(promise); },
    acceptWebSocket(socket) { sockets.push(socket); }, setWebSocketAutoResponse() {},
  };
  const { InventoryCore } = loadServiceModule("service/src/core.ts");
  const core = new InventoryCore(state, { APP_ENV: "beta", PROJECT_KEY: "fixture", FIREBASE_PROJECT_ID: "fixture", ...env });
  await Promise.all(state.tasks);
  return { db, state, core, kv, sockets, statements };
}

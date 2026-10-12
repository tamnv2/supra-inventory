import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { mealEditPolicy, vnMidnightMs } from "../service/src/meal-break-core.ts";

const day="2026-10-12", early=vnMidnightMs(day)+10*60*60_000+56*60_000;
const data={period:"LUNCH",choice:"LATE",role:"REPORTER",actorId:"reporter-1",originalActor:"reporter-1",oldChoice:"EARLY",dayVn:day,expectedDay:day,nowMs:early};
test("original Reporter or Admin/ROOT can amend before earliest start",()=>{
 assert.equal(mealEditPolicy(data),null);
 assert.equal(mealEditPolicy({...data,role:"ADMIN",actorId:"other"}),null);
 assert.equal(mealEditPolicy({...data,role:"ROOT",actorId:"other"}),null);
});
test("cannot change after earliest meal start or if current day changed",()=>{
 assert.equal(mealEditPolicy({...data,nowMs:vnMidnightMs(day)+11*60*60_000}),"MEAL_EDIT_WINDOW_CLOSED");
 assert.equal(mealEditPolicy({...data,period:"DINNER",nowMs:vnMidnightMs(day)+18*60*60_000}),"MEAL_EDIT_WINDOW_CLOSED");
 assert.equal(mealEditPolicy({...data,expectedDay:"2026-10-11"}),"INVALID_MEAL_EDIT");
});
test("other Reporter, non-allowed role, invalid payload and no-op cannot edit",()=>{
 assert.equal(mealEditPolicy({...data,actorId:"reporter-2"}),"MEAL_EDIT_FORBIDDEN");
 assert.equal(mealEditPolicy({...data,role:"PICKPACK_ADMIN"}),"MEAL_EDIT_FORBIDDEN");
 assert.equal(mealEditPolicy({...data,period:"OTHER"}),"INVALID_MEAL_EDIT");
 assert.equal(mealEditPolicy({...data,choice:"EARLY"}),"MEAL_CHOICE_UNCHANGED");
});
test("password proof happens in Worker; only safe identity and proof mode are forwarded to Core",()=>{
 const worker=readFileSync(new URL("../service/src/index.ts",import.meta.url),"utf8");
 const start=worker.indexOf('// D167 Web-only privileged meal amendment.');
 const end=worker.indexOf('// D167: Reporter-owned meal confirmation',start);
 const section=worker.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.match(section,/verifyCurrentAuthenticationProof\(env, actor, proofText\)/);
 assert.match(section,/if \(!proof\.valid\)/);
 assert.match(section,/actor_role: actor\.role, credential_mode: proof\.mode/);
 assert.doesNotMatch(section,/body: JSON\.stringify\(\{[^}]*current_password/);
 assert.match(section,/event: "meal_break_confirmed"/);
});
test("Core uses CAS, SQL transaction, audit and postchange alarm without changing Android",()=>{
 const core=readFileSync(new URL("../service/src/meal-break-core.ts",import.meta.url),"utf8");
 const router=readFileSync(new URL("../service/src/core.ts",import.meta.url),"utf8");
 const app=readFileSync(new URL("../web/src/operational-app.ts",import.meta.url),"utf8");
 assert.match(core,/transactionSync\(\(\) => \{/);
 assert.match(core,/WHERE day_vn=\? AND period=\? AND confirmed_at=\? AND choice=\?/);
 assert.match(core,/recalculateMealAdjustedDeadlines\(state\)/);
 assert.match(core,/MEAL_BREAK_EDIT/);
 assert.match(router,/url\.pathname === "\/d167\/meal\/edit"/);
 assert.match(router,/scheduleNextOperationalAlarm\(this\.state\)/);
 assert.match(app,/data-d167-meal-edit/);
 assert.match(app,/editD167Meal\(period, choice, password, day, old\.confirmed_at\)/);
});

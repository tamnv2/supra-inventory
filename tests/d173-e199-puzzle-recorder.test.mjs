import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const js = readFileSync("diagnostics/puzzle-recorder-v1/RecorderScript.js","utf8");
const cs = readFileSync("diagnostics/puzzle-recorder-v1/Program.cs","utf8");
test("geometry only: drag recorded but no keyboard/URL",()=>{
  const handlers = new Map(), messages=[];
  let now=100;
  const win={chrome:{webview:{postMessage:m=>messages.push(m)}}};win.top=win;
  runInNewContext(js,{window:win,document:{addEventListener:(name,fn)=>handlers.set(name,fn)},
    innerWidth:640,innerHeight:420,devicePixelRatio:1.25,performance:{now:()=>now},Math,Number});
  const e=(x,y)=>({isPrimary:true,button:0,pointerId:1,clientX:x,clientY:y,target:{closest:()=>null}});
  handlers.get("pointerdown")(e(20,40));now=165;handlers.get("pointermove")(e(35,40));
  now=260;handlers.get("pointerup")(e(145,41));
  assert.equal(messages.length,1);assert.equal(messages[0].kind,"supra-drag-v1");
  const data=JSON.stringify(messages);
  for(const s of ["password","token","url","cookie","username"]) assert.ok(!data.includes(s));
});
test("WebView2 private profile and no typed data recording",()=>{
  for(const s of ["IsInPrivateModeEnabled = true","IsPasswordAutosaveEnabled = false",
    "IsGeneralAutofillEnabled = false","SaveFileDialog","CapturePreviewAsync"])
    assert.ok(cs.includes(s),s);
  assert.ok(!cs.includes("KeyPress +="));assert.ok(!cs.includes("GetCookiesAsync"));
});
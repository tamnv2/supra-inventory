import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../service/src/obpp1291-core.ts',import.meta.url),'utf8');
const fromService=createRequire(new URL('../service/package.json',import.meta.url));
const ts=fromService('typescript');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
vm.runInNewContext(compiled,{exports,crypto:globalThis.crypto,URL,Request,Response,Date,console});
const {handleObppCoreRequest}=exports;

function scopedCore(){
  const generations=new Map();
  const queries=[];
  const sql={exec(query,...params){
    queries.push({query,params});
    if(query.startsWith('INSERT INTO obpp_sessions(')){
      const uid=params[0];generations.set(uid,(generations.get(uid)||0)+1);
      return {toArray:()=>[]};
    }
    if(query.startsWith('SELECT generation FROM obpp_sessions WHERE uid=')){
      const n=generations.get(params[0]);return {toArray:()=>n?[{generation:n}]:[]};
    }
    throw Error('Unexpected SQL: '+query);
  }};
  return {state:{storage:{sql}},generations,queries};
}
function req(path,data){
  return new Request('https://inventory-core.internal'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
}

test('actual registered admin and pickpack_admin Firebase UID with colon activates and checks its isolated generation',async()=>{
  for(const uid of ['admin:tamnv2','pickpack_admin:vps','admin:foo.bar','root','admin:staff-1']){
    const {state,generations,queries}=scopedCore();
    const first=await handleObppCoreRequest(state,req('/obpp1291/session/activate',{uid}));
    assert.equal(first.status,200,uid);
    assert.equal((await first.json()).session_generation,1);
    const checked=await handleObppCoreRequest(state,req('/obpp1291/session/check',{uid,generation:1}));
    assert.equal((await checked.json()).valid,true);
    const second=await handleObppCoreRequest(state,req('/obpp1291/session/activate',{uid}));
    assert.equal((await second.json()).session_generation,2);
    const revoked=await handleObppCoreRequest(state,req('/obpp1291/session/check',{uid,generation:1}));
    assert.equal((await revoked.json()).valid,false);
    assert.equal(generations.size,1);
    assert.ok(queries.every(row=>row.params.every(param=>typeof param==='string'||typeof param==='number')));
  }
});

test('rejects invalid/control or SQL injection UID without writing session',async()=>{
  for(const uid of ['',':admin','foo/bar','admin:foo\n','admin:foo\u0000','admin:foo;DROP TABLE users;--','a'.repeat(129),25,null]){
    const {state,queries}=scopedCore();
    const result=await handleObppCoreRequest(state,req('/obpp1291/session/activate',{uid}));
    assert.equal(result.status,400,JSON.stringify(uid));
    assert.equal((await result.json()).error,'INVALID_UID');
    assert.equal(queries.length,0);
  }
});

/** D172 isolated authoritative namespace: never mutates shortage/picklist tables. */
type Row = Record<string, SqlStorageValue>;
const allowedRoles = new Set(["ADMIN","PICKPACK_ADMIN","ROOT"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const storeRx = /^[A-Z0-9-]{1,24}$/;
const doRx = /^[0-9]{1,24}$/;

function reply(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
const now = () => new Date().toISOString();
function dayTime(iso: string): { day: string; time: string } {
  const vn = new Date(Date.parse(iso) + 7 * 3600_000).toISOString();
  return { day: vn.slice(8,10)+"/"+vn.slice(5,7)+"/"+vn.slice(0,4), time:vn.slice(11,19) };
}
function text(v: unknown, max = 512): string { return String(v ?? "").trim().slice(0,max); }
function position(v: unknown): string {
  const value = text(v,65).toUpperCase();
  if (!value || value.length>60 || /[\r\n\u0000-\u001f]/.test(value)) throw Error("INVALID_POSITION");
  return value;
}
function int(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n<1 || n>999999) throw Error("INVALID_TOTAL");
  return n;
}
function parcel(body: Record<string, unknown>) {
  const store_code=text(body.store_code,60).toUpperCase();
  const do_code=text(body.do_code,40);
  const total_parcels=int(body.total_parcels);
  const parcel_index=body.parcel_index==null?null:int(body.parcel_index);
  const raw_scan=text(body.raw_scan,513);
  if (!storeRx.test(store_code)||!doRx.test(do_code)||raw_scan.length>512) throw Error("INVALID_FIELDS");
  if (parcel_index && parcel_index>total_parcels) throw Error("INVALID_ORDINAL");
  if(raw_scan){
    const parts=raw_scan.split("|");
    if(parts.length!==6 || parts.some(p=>!p.trim()))throw Error("INVALID_QR");
    const match=/^([0-9]+)\/([0-9]+)$/.exec(parts[5].trim());
    if(!match || int(match[1])>int(match[2]))throw Error("INVALID_QR");
    if(!storeRx.test(parts[0].trim().toUpperCase())||!doRx.test(parts[1].trim()))throw Error("INVALID_QR");
  }
  return {store_code,do_code,total_parcels,parcel_index,raw_scan,location:position(body.location)};
}
function visibleRecord(r: Row) {
  return { id:r.id,raw_scan:r.raw_scan,store_code:r.store_code,do_code:r.do_code,
    total_parcels:r.total_parcels,parcel_index:r.parcel_index, location:r.location,
    date_vn:r.date_vn,time_vn:r.time_vn,actor_id:r.actor_id,
    revision:r.revision,sync_status:r.sync_status,updated_at:r.updated_at,deleted:Boolean(r.deleted) };
}
function actor(req: Request) {
  const userId=text(req.headers.get("x-obpp-user-id"),128);
  const role=text(req.headers.get("x-obpp-user-role"),30);
  if (!userId||!allowedRoles.has(role))throw Error("UNAUTHORIZED");
  return userId;
}
function operation(body: Record<string,unknown>): string {
  const op=text(body.operation_id,70);
  if(!uuid.test(op))throw Error("INVALID_OPERATION_ID");
  return op;
}
function event(state: DurableObjectState, id: string, kind: string, ref: string, revision: number) {
  state.storage.sql.exec(
    "INSERT OR IGNORE INTO obpp_outbox(event_key,kind,ref_id,revision,status,created_at) VALUES(?,?,?,?,?,?)",
    id,kind,ref,revision,"PENDING",now());
}
function audit(state: DurableObjectState, recordId:string, action:string, revision:number, userId:string, note:string): string {
  const id=crypto.randomUUID(), timestamp=now();
  state.storage.sql.exec(
    "INSERT INTO obpp_audit(id,record_id,action,revision,time,actor,note) VALUES(?,?,?,?,?,?,?)",
    id,recordId,action,revision,timestamp,userId,note.slice(0,160));
  event(state, "AUDIT:"+id, "AUDIT", id, revision);
  return id;
}
function writeResult(state: DurableObjectState, op:string, response: unknown) {
  state.storage.sql.exec("INSERT INTO obpp_operations(op_id,response_json,created_at) VALUES(?,?,?)",op,JSON.stringify(response),now());
}
function previousResult(state:DurableObjectState,op:string):unknown|null{
  const r=state.storage.sql.exec<Row>("SELECT response_json FROM obpp_operations WHERE op_id=?",op).toArray()[0];
  return r?JSON.parse(String(r.response_json)):null;
}

export function initializeObppSchema(state:DurableObjectState):void{
  const sql=state.storage.sql;
  sql.exec("CREATE TABLE IF NOT EXISTS obpp_sessions(uid TEXT PRIMARY KEY,generation INTEGER NOT NULL DEFAULT 0)");
  sql.exec(`CREATE TABLE IF NOT EXISTS obpp_records(
    id TEXT PRIMARY KEY, raw_scan TEXT NOT NULL, store_code TEXT NOT NULL, do_code TEXT NOT NULL,
    total_parcels INTEGER NOT NULL,parcel_index INTEGER,location TEXT NOT NULL,
    date_vn TEXT NOT NULL,time_vn TEXT NOT NULL,actor_id TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,sync_status TEXT NOT NULL DEFAULT 'PENDING')`);
  sql.exec(`CREATE TABLE IF NOT EXISTS obpp_locations(
    code TEXT PRIMARY KEY,active INTEGER NOT NULL DEFAULT 1,revision INTEGER NOT NULL,
    actor_id TEXT NOT NULL,updated_at TEXT NOT NULL)`);
  const locationCols=sql.exec<Row>("PRAGMA table_info(obpp_locations)").toArray();
  if(!locationCols.some(c=>String(c.name)==="sheet_key"))
    sql.exec("ALTER TABLE obpp_locations ADD COLUMN sheet_key TEXT");
  sql.exec("UPDATE obpp_locations SET sheet_key=code WHERE sheet_key IS NULL");
  sql.exec("CREATE TABLE IF NOT EXISTS obpp_migrations(key TEXT PRIMARY KEY)");
  sql.exec("CREATE TABLE IF NOT EXISTS obpp_sheet_state(key TEXT PRIMARY KEY,value TEXT NOT NULL)");
  sql.exec("CREATE TABLE IF NOT EXISTS obpp_operations(op_id TEXT PRIMARY KEY,response_json TEXT NOT NULL,created_at TEXT NOT NULL)");
  sql.exec("CREATE TABLE IF NOT EXISTS obpp_audit(id TEXT PRIMARY KEY,record_id TEXT NOT NULL,action TEXT NOT NULL,revision INTEGER NOT NULL,time TEXT NOT NULL,actor TEXT NOT NULL,note TEXT NOT NULL)");
  sql.exec(`CREATE TABLE IF NOT EXISTS obpp_outbox(
    event_key TEXT PRIMARY KEY,kind TEXT NOT NULL,ref_id TEXT NOT NULL,
    revision INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'PENDING',claimed_until INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)`);
  sql.exec("CREATE TABLE IF NOT EXISTS obpp_sync_lock(name TEXT PRIMARY KEY,owner TEXT NOT NULL,expires_at INTEGER NOT NULL)");
  sql.exec("CREATE TABLE IF NOT EXISTS obpp_sync_failures(event_key TEXT PRIMARY KEY,attempts INTEGER NOT NULL DEFAULT 0,last_failure_at TEXT NOT NULL,retry_after_ms INTEGER NOT NULL DEFAULT 0)");
  sql.exec("CREATE INDEX IF NOT EXISTS obpp_recent_idx ON obpp_records(created_at DESC)");
  sql.exec("CREATE INDEX IF NOT EXISTS obpp_pending_idx ON obpp_outbox(status,created_at)");
  if(!sql.exec<Row>("SELECT key FROM obpp_migrations WHERE key='LOCATION_SHEET_KEY_V1'").toArray().length){
    state.storage.transactionSync(()=>{
      for(const row of sql.exec<Row>("SELECT code,revision FROM obpp_locations").toArray())
        event(state,"LOCATION:"+row.code+":sheet_key_v1","LOCATION",String(row.code),Number(row.revision));
      sql.exec("INSERT OR IGNORE INTO obpp_migrations(key) VALUES('LOCATION_SHEET_KEY_V1')");
    });
  }
}

export async function handleObppCoreRequest(state:DurableObjectState,request:Request):Promise<Response|null>{
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(!path.startsWith("/obpp1291/"))return null;
  try{
    const sql=state.storage.sql;
    if(path==="/obpp1291/session/activate" && method==="POST"){
      const {uid}=await request.json() as {uid:string};
      // E012 FIELD FAIL: existing InventoryCore Firebase UIDs are role-prefixed
      // (e.g. "admin:username"); ':' was rejected by the original D172-only
      // validator. Match the registered username/role UID alphabet, bound SQL
      // parameters, 1..128 chars; never rewrite Firebase identities.
      if(typeof uid!=="string" || !/^[A-Za-z0-9_-][A-Za-z0-9._:-]{0,127}$/.test(uid))
        return reply({error:"INVALID_UID"},400);
      sql.exec("INSERT INTO obpp_sessions(uid,generation) VALUES(?,1) ON CONFLICT(uid) DO UPDATE SET generation=generation+1",uid);
      const row=sql.exec<Row>("SELECT generation FROM obpp_sessions WHERE uid=?",uid).toArray()[0];
      return reply({session_generation:Number(row.generation)});
    }
    if(path==="/obpp1291/session/check" && method==="POST"){
      const {uid,generation}=await request.json() as {uid:string;generation:number};
      const row=sql.exec<Row>("SELECT generation FROM obpp_sessions WHERE uid=?",uid).toArray()[0];
      return reply({valid:Boolean(row && Number(row.generation)===generation)});
    }
    const userId=actor(request);
    if(path==="/obpp1291/locations" && method==="GET"){
      const locations=sql.exec<Row>("SELECT code,active,revision,actor_id,updated_at,sheet_key FROM obpp_locations ORDER BY code ASC LIMIT 500").toArray()
        .map(r=>({code:r.code,active:Boolean(r.active),revision:r.revision,updated_at:r.updated_at,sheet_key:r.sheet_key||r.code}));
      return reply({locations});
    }
    if(path==="/obpp1291/records" && method==="GET"){
      const limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit"))||50));
      const records=sql.exec<Row>("SELECT * FROM obpp_records WHERE deleted=0 ORDER BY created_at DESC LIMIT ?",limit).toArray().map(visibleRecord);
      return reply({records});
    }
    if(path==="/obpp1291/outbox/claim" && method==="POST"){
      if(request.headers.get("x-obpp-internal")!=="sync")return reply({error:"FORBIDDEN"},403);
      const payload=await request.json() as {lease_token?:string;limit?:number};
      if(!payload.lease_token || !uuid.test(payload.lease_token))return reply({error:"INVALID_LEASE"},400);
      const limit=Math.min(10,Math.max(1,Number(payload.limit)||10));
      const result=state.storage.transactionSync(()=>{
        const lease=sql.exec<Row>("SELECT owner,expires_at FROM obpp_sync_lock WHERE name='sheets'").toArray()[0];
        if(lease && Number(lease.expires_at)>Date.now())return {items:[] as Row[],busy:true};
        sql.exec("INSERT INTO obpp_sync_lock(name,owner,expires_at) VALUES('sheets',?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at",payload.lease_token,Date.now()+90000);
        const items=sql.exec<Row>("SELECT event_key,kind,ref_id,revision FROM obpp_outbox o WHERE (status='PENDING' OR (status='IN_FLIGHT' AND claimed_until<?)) AND NOT EXISTS(SELECT 1 FROM obpp_sync_failures f WHERE f.event_key=o.event_key AND f.retry_after_ms>?) ORDER BY created_at,event_key LIMIT ?",Date.now(),Date.now(),limit).toArray();
        for(const item of items)sql.exec("UPDATE obpp_outbox SET status='IN_FLIGHT',claimed_until=? WHERE event_key=?",Date.now()+90000,item.event_key);
        return {items,busy:false};
      });
      const items=result.items.map(o=>{
        const table=o.kind==="AUDIT"?"obpp_audit":o.kind==="LOCATION"?"obpp_locations":"obpp_records";
        const column=o.kind==="LOCATION"?"code":"id";
        const row=sql.exec<Row>(`SELECT * FROM ${table} WHERE ${column}=? LIMIT 1`,o.ref_id).toArray()[0];
        return {event_key:o.event_key,kind:o.kind,ref_id:o.ref_id,revision:o.revision,row};
      }).filter(x=>Boolean(x.row));
      return reply({items,busy:result.busy});
    }
    if(path==="/obpp1291/outbox/finish" && method==="POST"){
      if(request.headers.get("x-obpp-internal")!=="sync")return reply({error:"FORBIDDEN"},403);
      const payload=await request.json() as {lease_token?:string};
      if(!payload.lease_token || !uuid.test(payload.lease_token))return reply({error:"INVALID_LEASE"},400);
      sql.exec("DELETE FROM obpp_sync_lock WHERE name='sheets' AND owner=?",payload.lease_token);
      return reply({ok:true});
    }
    if(path==="/obpp1291/outbox/release" && method==="POST"){
      if(request.headers.get("x-obpp-internal")!=="sync")return reply({error:"FORBIDDEN"},403);
      const body=await request.json() as {event_key:string};
      const item=sql.exec<Row>("SELECT kind,ref_id,revision FROM obpp_outbox WHERE event_key=? AND status='IN_FLIGHT'",body.event_key).toArray()[0];
      if(item){
        sql.exec("UPDATE obpp_outbox SET status='PENDING',claimed_until=0 WHERE event_key=?",body.event_key);
        const prior=sql.exec<Row>("SELECT attempts FROM obpp_sync_failures WHERE event_key=?",body.event_key).toArray()[0];
        const attempt=Number(prior?.attempts||0)+1;
        const pause=Math.min(300000,5000*Math.pow(2,Math.min(attempt-1,6)));
        sql.exec("INSERT INTO obpp_sync_failures(event_key,attempts,last_failure_at,retry_after_ms) VALUES(?,?,?,?) ON CONFLICT(event_key) DO UPDATE SET attempts=excluded.attempts,last_failure_at=excluded.last_failure_at,retry_after_ms=excluded.retry_after_ms",
          body.event_key,attempt,now(),Date.now()+pause);
        const attempts={attempts:attempt};
        if(item.kind==="RECORD" && Number(attempts?.attempts||0)>=3)
          sql.exec("UPDATE obpp_records SET sync_status='ERROR' WHERE id=? AND revision=? AND sync_status!='SYNCED'",item.ref_id,item.revision);
      }
      return reply({ok:true});
    }
    if(path==="/obpp1291/outbox/ack" && method==="POST"){
      if(request.headers.get("x-obpp-internal")!=="sync")return reply({error:"FORBIDDEN"},403);
      const b=await request.json() as {event_key:string;kind:string;ref_id:string;revision:number};
      sql.exec("UPDATE obpp_outbox SET status='SYNCED' WHERE event_key=? AND revision=?",b.event_key,b.revision);
      if(b.kind==="RECORD"){
        const pending=sql.exec<Row>("SELECT COUNT(*) AS n FROM obpp_outbox WHERE kind='RECORD' AND ref_id=? AND status='PENDING'",b.ref_id).toArray()[0];
        if(Number(pending.n)===0)sql.exec("UPDATE obpp_records SET sync_status='SYNCED' WHERE id=? AND revision=?",b.ref_id,b.revision);
      }
      return reply({ok:true});
    }

    if(path==="/obpp1291/records/bulk-delete" && method==="POST"){
      const b=await request.json() as {operation_id?:string;items?:Array<{id:string;expected_revision:number}>};
      const op=operation(b as Record<string,unknown>);
      const previous=previousResult(state,op);
      if(previous)return reply(previous);
      const items=b.items;
      if(!Array.isArray(items) || items.length<1 || items.length>100 ||
        items.some(i=>!i || typeof i.id!=="string" || !uuid.test(i.id) ||
          !Number.isSafeInteger(i.expected_revision) || i.expected_revision<1) ||
        new Set(items.map(i=>i.id)).size!==items.length)
        return reply({error:"INVALID_BATCH"},400);
      let conflict=false;
      let result:Record<string,unknown>={};
      state.storage.transactionSync(()=>{
        const duplicate=previousResult(state,op);
        if(duplicate){result=duplicate as Record<string,unknown>;return;}
        for(const item of items){
          const row=sql.exec<Row>("SELECT revision,deleted FROM obpp_records WHERE id=?",item.id).toArray()[0];
          if(!row || Number(row.deleted)!==0 || Number(row.revision)!==item.expected_revision){
            conflict=true;return;
          }
        }
        const stamp=now();
        for(const item of items){
          const revision=item.expected_revision+1;
          sql.exec("UPDATE obpp_records SET deleted=1,revision=?,actor_id=?,updated_at=?,sync_status='PENDING' WHERE id=?",
            revision,userId,stamp,item.id);
          audit(state,item.id,"DELETE",revision,userId,"BULK");
          event(state,"RECORD:"+item.id+":"+revision,"RECORD",item.id,revision);
        }
        result={deleted_count:items.length,sync_status:"PENDING"};
        writeResult(state,op,result);
      });
      return conflict?reply({error:"CONFLICT_OR_CHANGED_REVISION"},409):reply(result);
    }
    if(path==="/obpp1291/sheet/watermark" && method==="POST"){
      if(request.headers.get("x-obpp-internal")!=="sync")return reply({error:"FORBIDDEN"},403);
      const payload=await request.json() as {modified_time?:string;commit?:boolean};
      const stamp=text(payload.modified_time,60);
      if(!/^\d{4}-\d{2}-\d{2}T/.test(stamp))return reply({error:"INVALID_TIMESTAMP"},400);
      const previous=sql.exec<Row>("SELECT value FROM obpp_sheet_state WHERE key='modified_time'").toArray()[0];
      if(payload.commit===true)
        sql.exec("INSERT INTO obpp_sheet_state(key,value) VALUES('modified_time',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",stamp);
      return reply({changed:String(previous?.value||"")!==stamp});
    }
    if(path==="/obpp1291/sheet/reconcile" && method==="POST"){
      if(request.headers.get("x-obpp-internal")!=="sync")return reply({error:"FORBIDDEN"},403);
      const b=await request.json() as {records?:Record<string,unknown>[];locations?:Record<string,unknown>[]};
      if(!Array.isArray(b.records)||!Array.isArray(b.locations)||
        b.records.length>5000||b.locations.length>500)return reply({error:"INVALID_RECONCILE"},400);
      let applied=0,skipped=0;
      // Sheet is a sanctioned editor only for already-known records with
      // matching server revision and fully-SYNCED outgoing mirror.
      for(const row of b.records){
        const id=text(row.id,64);
        if(!uuid.test(id)){skipped++;continue;}
        const current=sql.exec<Row>("SELECT * FROM obpp_records WHERE id=?",id).toArray()[0];
        if(!current || Number(current.deleted)!==0 || String(current.sync_status)!=="SYNCED"||
          Number(row.revision)!==Number(current.revision)){skipped++;continue;}
        let p:ReturnType<typeof parcel>;
        try{
          p=parcel(row);
          const active=sql.exec<Row>("SELECT active FROM obpp_locations WHERE code=?",p.location).toArray()[0];
          if(!active || Number(active.active)!==1)throw Error("INACTIVE_POSITION");
        }catch{skipped++;continue;}
        if(String(current.raw_scan)===p.raw_scan && String(current.store_code)===p.store_code &&
           String(current.do_code)===p.do_code &&
           Number(current.total_parcels)===p.total_parcels &&
           Number(current.parcel_index||0)===Number(p.parcel_index||0) &&
           String(current.location)===p.location)continue;
        state.storage.transactionSync(()=>{
          const latest=sql.exec<Row>("SELECT revision,sync_status FROM obpp_records WHERE id=?",id).toArray()[0];
          if(!latest || latest.sync_status!=="SYNCED"||Number(latest.revision)!==Number(row.revision)){
            skipped++;return;
          }
          const rev=Number(latest.revision)+1;
          sql.exec("UPDATE obpp_records SET raw_scan=?,store_code=?,do_code=?,total_parcels=?,parcel_index=?,location=?,revision=?,actor_id='SYSTEM_SHEET',updated_at=?,sync_status='PENDING' WHERE id=?",
            p.raw_scan,p.store_code,p.do_code,p.total_parcels,p.parcel_index,p.location,rev,now(),id);
          audit(state,id,"SHEET_EDIT",rev,"SYSTEM_SHEET","");
          event(state,"RECORD:"+id+":"+rev,"RECORD",id,rev);
          applied++;
        });
      }
      for(const row of b.locations){
        const sheetKey=text(row.sheet_key,60);
        if(!sheetKey || /^[=+@-]/.test(sheetKey)){skipped++;continue;}
        const current=sql.exec<Row>("SELECT * FROM obpp_locations WHERE sheet_key=?",sheetKey).toArray()[0];
        if(!current){skipped++;continue;}
        let next:string;
        try{next=position(row.code);if(/^[=+@-]/.test(next))throw Error("INVALID");}
        catch{skipped++;continue;}
        if(Number(row.revision)!==Number(current.revision)){skipped++;continue;}
        const active=row.active===true?1:row.active===false?0:-1;
        if(active<0){skipped++;continue;}
        if(String(current.code)===next && Number(current.active)===active)continue;
        state.storage.transactionSync(()=>{
          const latest=sql.exec<Row>("SELECT * FROM obpp_locations WHERE sheet_key=?",sheetKey).toArray()[0];
          if(!latest||Number(latest.revision)!==Number(row.revision)||
            (next!==latest.code && sql.exec<Row>("SELECT code FROM obpp_locations WHERE code=?",next).toArray().length)){
            skipped++;return;
          }
          const revision=Number(latest.revision)+1;
          sql.exec("UPDATE obpp_locations SET code=?,active=?,revision=?,actor_id='SYSTEM_SHEET',updated_at=? WHERE sheet_key=?",
            next,active,revision,now(),sheetKey);
          sql.exec("UPDATE obpp_outbox SET ref_id=? WHERE kind='LOCATION' AND ref_id=? AND status!='SYNCED'",
            next,latest.code);
          event(state,"LOCATION:"+next+":"+revision,"LOCATION",next,revision);
          audit(state,next,next===latest.code?"SHEET_STATUS":"SHEET_RENAME",revision,"SYSTEM_SHEET",sheetKey);
          applied++;
        });
      }
      return reply({applied,skipped});
    }
    const isRecord=path==="/obpp1291/records"&&method==="POST";
    const isLocation=path==="/obpp1291/locations"&&method==="POST";
    const recMatch=/^\/obpp1291\/records\/([a-f0-9-]{36})$/i.exec(path);
    const locMatch=/^\/obpp1291\/locations\/(.+)$/.exec(path);
    if(!isRecord&&!isLocation&&!recMatch&&!locMatch)return reply({error:"NOT_FOUND"},404);
    if(!["POST","PATCH","DELETE"].includes(method))return reply({error:"METHOD_NOT_ALLOWED"},405);
    const b=await request.json() as Record<string,unknown>;
    const op=operation(b);
    const old=previousResult(state,op);
    if(old)return reply(old);

    let response:Record<string,unknown>={};
    let conflict=false;
    state.storage.transactionSync(()=>{
      const replay=previousResult(state,op);
      if(replay){response=replay as Record<string,unknown>;return;}
      if(isLocation){
        const code=position(b.code);
        const existing=sql.exec<Row>("SELECT code FROM obpp_locations WHERE code=?",code).toArray()[0];
        if(existing){conflict=true;return;}
        sql.exec("INSERT INTO obpp_locations(code,active,revision,actor_id,updated_at,sheet_key) VALUES(?,1,1,?,?,?)",code,userId,now(),code);
        event(state,"LOCATION:"+code+":1","LOCATION",code,1);
        audit(state,code,"LOCATION_ADD",1,userId,code);
        response={code,active:true,revision:1,sync_status:"PENDING"};
      }else if(locMatch && method==="PATCH"){
        const oldCode=position(decodeURIComponent(locMatch[1]));
        const before=sql.exec<Row>("SELECT * FROM obpp_locations WHERE code=?",oldCode).toArray()[0];
        if(!before){conflict=true;return;}
        const next= b.code!==undefined ? position(b.code) : oldCode;
        const active=typeof b.active==="boolean"?(b.active?1:0):Number(before.active);
        const revision=Number(before.revision)+1;
        if(next!==oldCode && sql.exec<Row>("SELECT code FROM obpp_locations WHERE code=?",next).toArray().length){conflict=true;return;}
        sql.exec("UPDATE obpp_locations SET code=?,active=?,revision=?,actor_id=?,updated_at=? WHERE code=?",next,active,revision,userId,now(),oldCode);
        sql.exec("UPDATE obpp_outbox SET ref_id=? WHERE kind='LOCATION' AND ref_id=? AND status!='SYNCED'",next,oldCode);
        event(state,"LOCATION:"+next+":"+revision,"LOCATION",next,revision);
        audit(state,next,next!==oldCode?"LOCATION_RENAME":"LOCATION_STATUS",revision,userId,oldCode);
        response={code:next,active:Boolean(active),revision,sync_status:"PENDING"};
      }else if(isRecord){
        const p=parcel(b);
        const active=sql.exec<Row>("SELECT active FROM obpp_locations WHERE code=?",p.location).toArray()[0];
        if(!active||Number(active.active)!==1){conflict=true;return;}
        const id=crypto.randomUUID(),timestamp=now(),dt=dayTime(timestamp);
        sql.exec(`INSERT INTO obpp_records(id,raw_scan,store_code,do_code,total_parcels,parcel_index,location,
          date_vn,time_vn,actor_id,revision,created_at,updated_at,deleted,sync_status)
          VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?,0,'PENDING')`,
          id,p.raw_scan,p.store_code,p.do_code,p.total_parcels,p.parcel_index,p.location,
          dt.day,dt.time,userId,timestamp,timestamp);
        event(state,"RECORD:"+id+":1","RECORD",id,1);
        audit(state,id,"CREATE",1,userId,p.do_code);
        response={id,revision:1,sync_status:"PENDING"};
      }else if(recMatch && (method==="PATCH"||method==="DELETE")){
        const id=recMatch[1];
        const before=sql.exec<Row>("SELECT * FROM obpp_records WHERE id=?",id).toArray()[0];
        if(!before||Number(before.deleted)!==0 || Number(b.expected_revision)!==Number(before.revision)){conflict=true;return;}
        const revision=Number(before.revision)+1;
        if(method==="DELETE"){
          sql.exec("UPDATE obpp_records SET deleted=1,revision=?,actor_id=?,updated_at=?,sync_status='PENDING' WHERE id=?",revision,userId,now(),id);
          audit(state,id,"DELETE",revision,userId,"");
        }else{
          const p=parcel(b);
          const active=sql.exec<Row>("SELECT active FROM obpp_locations WHERE code=?",p.location).toArray()[0];
          if(!active||Number(active.active)!==1){conflict=true;return;}
          sql.exec(`UPDATE obpp_records SET raw_scan=?,store_code=?,do_code=?,total_parcels=?,parcel_index=?,
            location=?,actor_id=?,revision=?,updated_at=?,sync_status='PENDING' WHERE id=?`,
            p.raw_scan,p.store_code,p.do_code,p.total_parcels,p.parcel_index,p.location,userId,revision,now(),id);
          audit(state,id,"EDIT",revision,userId,p.do_code);
        }
        event(state,"RECORD:"+id+":"+revision,"RECORD",id,revision);
        response={id,revision,sync_status:"PENDING",deleted:method==="DELETE"};
      }
      if(!conflict)writeResult(state,op,response);
    });
    return conflict?reply({error:"CONFLICT_OR_INACTIVE_POSITION"},409):reply(response);
  }catch(error){
    const msg=error instanceof Error?error.message:"INVALID_REQUEST";
    return reply({error:/^INVALID_/.test(msg)?msg:"OBPP_REQUEST_FAILED"},/^INVALID_/.test(msg)?400:500);
  }
}

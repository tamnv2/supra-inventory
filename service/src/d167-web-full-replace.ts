/** D167 Web FULL REPLACE, explicitly separate from PATCH imports.
 * One approved, revision-fenced atomic publication. Never deletes master/history.
 */
type SkuFullRow = { sku:string; product_name:string; area?:string };
type ExistingFullRow = { sku:string; product_name:string; active:number|null; area:string|null; area_verified:number|null };
type FullActor = { user_id:string; employee_code?:string|null };
const sendFull = (data:unknown, status=200) => new Response(JSON.stringify(data), {
  status, headers: {"content-type":"application/json","cache-control":"no-store"},
});
export async function handleD167WebFullReplace(
  state:DurableObjectState, request:Request,
):Promise<Response|null> {
  if (new URL(request.url).pathname !== "/business/skus/full-replace") return null;
  if (request.method !== "POST") return sendFull({error:"METHOD_NOT_ALLOWED"},405);
  let body:Record<string,unknown>;
  try {
    const parsed=await request.json();
    if (!parsed || typeof parsed!=="object" || Array.isArray(parsed)) throw Error();
    body=parsed as Record<string,unknown>;
  } catch { return sendFull({error:"INVALID_JSON"},400); }
  const actor=body.actor as FullActor|undefined;
  const requestId=String(body.request_id||"").trim();
  const sourceHash=String(body.source_hash||"").trim();
  const itemsRaw=body.items;
  if (!actor?.user_id || !/^[A-Za-z0-9._:-]{8,160}$/.test(requestId) ||
      !/^[a-f0-9]{64}$/.test(sourceHash) || !Array.isArray(itemsRaw) ||
      itemsRaw.length<1 || itemsRaw.length>5000)
    return sendFull({error:"INVALID_FULL_SOURCE"},400);
  const incoming:SkuFullRow[]=[];
  const seen=new Set<string>();
  for (const raw of itemsRaw) {
    if (!raw || typeof raw!=="object" || Array.isArray(raw))
      return sendFull({error:"INVALID_FULL_ROW"},400);
    const record=raw as Record<string,unknown>;
    const sku=String(record.sku??"").trim();
    const product_name=String(record.product_name??"").trim().replace(/\s+/g," ").normalize("NFC");
    const area=String(record.area??"").trim().toUpperCase();
    if (!sku || sku.length>128 || !product_name || product_name.length>500 ||
        /[\r\n]/.test(sku) || seen.has(sku) || (area!=="" && area!=="LTA" && area!=="SHELVING"))
      return sendFull({error:"INVALID_OR_DUPLICATE_FULL_SKU"},400);
    seen.add(sku);
    incoming.push({sku,product_name,...(area?{area}:{})});
  }
  // A lost HTTP response after an atomic successful FULL must be recoverable
  // by the same idempotency key even though the catalog revision advanced.
  const scope="d167_web_full_replace:"+actor.user_id;
  if (body.dry_run!==true) {
    const old=state.storage.sql.exec<{response_json:string}>(
      "SELECT response_json FROM idempotency_keys WHERE scope=? AND idempotency_key=?",
      scope,requestId).toArray()[0];
    if (old) {
      const receipt=JSON.parse(old.response_json) as Record<string,unknown>;
      if (receipt.source_hash!==sourceHash)
        return sendFull({error:"FULL_REPLACE_IDEMPOTENCY_KEY_REUSED"},409);
      return sendFull({...receipt,idempotent_replay:true});
    }
  }
  const master=state.storage.sql.exec<ExistingFullRow>(`
    SELECT s.sku,s.product_name,a.active,a.area,a.area_verified FROM sku_master s
    LEFT JOIN d167_sku_active a ON a.sku=s.sku ORDER BY s.sku
  `).toArray();
  const meta=state.storage.sql.exec<{revision:number;last_full_day:string|null}>(
    "SELECT revision,last_full_day FROM d167_sku_meta WHERE id=1").toArray()[0];
  const revision=Number(meta?.revision??0);
  const bySku=new Map(master.map(x=>[x.sku,x]));
  const active=master.filter(x=>!meta?.last_full_day || x.active==null || Number(x.active)===1);
  const hidden=active.filter(x=>!seen.has(x.sku)).length;
  const toCreate=incoming.filter(x=>!bySku.has(x.sku));
  const toRename=incoming.filter(x=>bySku.has(x.sku)&&bySku.get(x.sku)!.product_name!==x.product_name);
  const toActivate=incoming.filter(x=>bySku.get(x.sku)?.active===0);
  const toAreaChanged=incoming.filter(x=>x.area &&
    (!bySku.has(x.sku) || bySku.get(x.sku)?.area!==x.area || bySku.get(x.sku)?.area_verified!==1));
  const preview={
    status:"PREVIEW",source_hash:sourceHash,catalog_revision:revision,
    source_rows:incoming.length,previous_active:active.length,
    created:toCreate.length,renamed:toRename.length,reactivated:toActivate.length,
    area_updated:toAreaChanged.length,
    hidden,unchanged:incoming.filter(x=>{
      const old=bySku.get(x.sku);
      return old && old.product_name===x.product_name && old.active!==0 &&
        (!x.area || (old.area===x.area && old.area_verified===1));
    }).length,
    area_conflicts:toAreaChanged.filter(x=>bySku.has(x.sku)).slice(0,25).map(x=>({
      sku:x.sku,current:bySku.get(x.sku)?.area||"UNKNOWN",incoming:x.area,
    })),
    name_conflicts:toRename.slice(0,25).map(x=>({
      sku:x.sku,current:bySku.get(x.sku)!.product_name,incoming:x.product_name,
    })),
    requires_explicit_full_replace_confirmation:true,
  };
  if (body.dry_run===true) return sendFull(preview);
  if (body.confirm_full_replace!==true ||
      ((toRename.length>0 || toAreaChanged.length>0) && body.confirm_name_changes!==true))
    return sendFull({error:"FULL_REPLACE_REQUIRES_CONFIRMATION",...preview},409);
  if (Number(body.expected_catalog_revision)!==revision ||
      body.expected_source_hash!==sourceHash)
    return sendFull({error:"FULL_REPLACE_STALE_PREVIEW"},409);
  const result=state.storage.transactionSync(()=>{
    const replay=state.storage.sql.exec<{response_json:string}>(
      "SELECT response_json FROM idempotency_keys WHERE scope=? AND idempotency_key=?",
      scope,requestId).toArray()[0];
    if (replay) return { ...JSON.parse(replay.response_json) as Record<string,unknown>, idempotent_replay:true };
    const current=Number(state.storage.sql.exec<{revision:number}>(
      "SELECT revision FROM d167_sku_meta WHERE id=1").toArray()[0]?.revision??0);
    if (current!==revision) return {error:"FULL_REPLACE_REVISION_CHANGED",catalog_revision:current};
    const at=new Date().toISOString();
    const day=new Date(Date.now()+7*3600_000).toISOString().slice(0,10);
    state.storage.sql.exec("CREATE TABLE IF NOT EXISTS d167_web_full_stage(sku TEXT PRIMARY KEY)");
    state.storage.sql.exec("DELETE FROM d167_web_full_stage");
    for (const x of incoming)
      state.storage.sql.exec("INSERT INTO d167_web_full_stage(sku) VALUES (?)",x.sku);
    const stageCount=state.storage.sql.exec<{n:number}>(
      "SELECT COUNT(*) AS n FROM d167_web_full_stage").toArray()[0]?.n;
    if (Number(stageCount)!==incoming.length) throw new Error("FULL_REPLACE_STAGE_MISMATCH");
    for (const x of incoming) {
      const original=bySku.get(x.sku);
      if (!original) {
        state.storage.sql.exec(
          "INSERT INTO sku_master(sku,product_name,source_hash,created_at,updated_at) VALUES (?,?,?,?,?)",
          x.sku,x.product_name,sourceHash,at,at);
      } else if (original.product_name!==x.product_name) {
        state.storage.sql.exec(
          "UPDATE sku_master SET product_name=?,source_hash=?,updated_at=? WHERE sku=?",
          x.product_name,sourceHash,at,x.sku);
      }
      const nameEdited=!original||original.product_name!==x.product_name;
      const areaEdited=Boolean(x.area && (!original || original.area!==x.area || original.area_verified!==1));
      if (original && original.active===1 && !nameEdited && !areaEdited) continue;
      state.storage.sql.exec(`INSERT INTO d167_sku_active
        (sku,active,area,area_verified,last_web_name_at)
        VALUES (?,1,'UNKNOWN',0,?)
        ON CONFLICT(sku) DO UPDATE SET active=1,
          last_web_name_at=CASE WHEN ? THEN excluded.last_web_name_at
                               ELSE d167_sku_active.last_web_name_at END`,
          x.sku,nameEdited?at:null,nameEdited?1:0);
      if (areaEdited && x.area) {
        state.storage.sql.exec(`UPDATE d167_sku_active
          SET area=?,area_verified=1,last_web_area_at=? WHERE sku=?`,x.area,at,x.sku);
        const history=state.storage.sql.exec<{area:string}>(
          "SELECT area FROM d167_sku_area_history WHERE sku=? AND effective_to IS NULL",x.sku).toArray()[0];
        if (!history || history.area!==x.area) {
          if (history) state.storage.sql.exec(
            "UPDATE d167_sku_area_history SET effective_to=? WHERE sku=? AND effective_to IS NULL",
            at,x.sku);
          state.storage.sql.exec(
            "INSERT INTO d167_sku_area_history(sku,area,effective_from,day_vn,source_slot) VALUES (?,?,?,?,?)",
            x.sku,x.area,at,day,"WEB_APPROVED_FULL");
        }
      }
    }
    // The original master may have no active metadata until its first FULL.
    state.storage.sql.exec(`INSERT OR IGNORE INTO d167_sku_active
      (sku,active,area,area_verified)
      SELECT sku,0,'UNKNOWN',0 FROM sku_master WHERE NOT EXISTS(
        SELECT 1 FROM d167_web_full_stage st WHERE st.sku=sku_master.sku)`);
    state.storage.sql.exec(`UPDATE d167_sku_active SET active=0 WHERE active=1
      AND NOT EXISTS(SELECT 1 FROM d167_web_full_stage st WHERE st.sku=d167_sku_active.sku)`);
    const wrong=state.storage.sql.exec<{n:number}>(`
      SELECT COUNT(*) AS n FROM sku_master s JOIN d167_sku_active a ON a.sku=s.sku
      WHERE (a.active=1 AND NOT EXISTS(SELECT 1 FROM d167_web_full_stage st WHERE st.sku=s.sku))
       OR (a.active=0 AND EXISTS(SELECT 1 FROM d167_web_full_stage st WHERE st.sku=s.sku))
    `).toArray()[0]?.n;
    if (Number(wrong)!==0) throw new Error("FULL_REPLACE_READBACK_MISMATCH");
    const changed=toCreate.length+toRename.length+toAreaChanged.length+toActivate.length+hidden>0;
    const memberChange=toCreate.length+toActivate.length+hidden>0;
    state.storage.sql.exec(`UPDATE d167_sku_meta SET
      last_full_day=?,revision=revision+?,published_at=CASE WHEN ? THEN ? ELSE published_at END,
      membership_changed_at=CASE WHEN ? THEN ? ELSE membership_changed_at END
      WHERE id=1`,day,changed?1:0,changed?1:0,at,memberChange?1:0,at);
    state.storage.sql.exec(`INSERT OR IGNORE INTO sku_catalog_meta(id,item_count,max_updated_at)
      SELECT 1,COUNT(*),MAX(updated_at) FROM sku_master`);
    if (toCreate.length+toRename.length+toActivate.length+hidden>0) state.storage.sql.exec(`UPDATE sku_catalog_meta
      SET item_count=(SELECT COUNT(*) FROM sku_master),max_updated_at=? WHERE id=1`,at);
    const payload={...preview,status:"DONE",catalog_revision:revision+(changed?1:0),completed_at:at,
      sku_day_first_full:String(meta?.last_full_day || "") !== day};
    state.storage.sql.exec(`INSERT INTO audit_log
      (audit_id,actor_user_id,actor_employee_code,action,target_type,target_id,metadata_json,created_at)
      VALUES (?,?,?,?,?,?,?,?)`,
      crypto.randomUUID(),actor.user_id,actor.employee_code??null,
      "SKU_WEB_FULL_REPLACE","SKU_MASTER",requestId,
      JSON.stringify({source_hash:sourceHash,created:toCreate.length,renamed:toRename.length,
        reactivated:toActivate.length,area_updated:toAreaChanged.length,hidden,source_rows:incoming.length}),at);
    state.storage.sql.exec(
      "INSERT INTO idempotency_keys(scope,idempotency_key,response_json,created_at) VALUES (?,?,?,?)",
      scope,requestId,JSON.stringify(payload),at);
    state.storage.sql.exec("DELETE FROM d167_web_full_stage");
    return payload;
  });
  if ("error" in result) return sendFull(result,409);
  return sendFull(result);
}

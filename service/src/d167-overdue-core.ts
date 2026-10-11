import { vnDayAt, vnMidnightMs, mealWindowsBetween } from "./meal-break-core";
import { correctionDeadlineFromResult } from "./sla-automation";
import type { OperationalDeadlineEffect } from "./sla-automation";

type SqlRow = Record<string, SqlStorageValue>;
const HALF_HOUR_MS = 30 * 60_000;
const ONE_HOUR_MS = 60 * 60_000;
const DAY_MS = 86_400_000;
const SYSTEM_ACTOR = "system:day_end";
const MAX_BATCHES = 50;

function one<T extends SqlRow>(rows: T[]): T | null { return rows[0] || null; }

export function initializeD167OverdueSchema(state: DurableObjectState): void {
  state.storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS d167_overdue_reminder_events (
      batch_id TEXT NOT NULL,
      level INTEGER NOT NULL CHECK (level IN (30,60)),
      created_at TEXT NOT NULL,
      event_id TEXT,
      PRIMARY KEY(batch_id,level)
    );
    CREATE INDEX IF NOT EXISTS idx_d167_overdue_reminders_batch ON d167_overdue_reminder_events(batch_id);
  `);
  state.storage.sql.exec(
    "INSERT OR IGNORE INTO app_config (key,value_json,updated_at,updated_by) VALUES ('d167_day_end_effective_at',?,CURRENT_TIMESTAMP,'system:d167-bootstrap')",
    JSON.stringify({ effective_at: new Date().toISOString() }),
  );
}

function startAt(state: DurableObjectState): string {
  const r = one(state.storage.sql.exec<SqlRow>(
    "SELECT value_json FROM app_config WHERE key = 'd167_day_end_effective_at' LIMIT 1"
  ).toArray());
  try { return String((JSON.parse(String(r?.value_json || "{}")) as {effective_at?:string}).effective_at || "9999-12-31"); }
  catch { return "9999-12-31"; }
}

function dayCloseAt(firstReport: string): number {
  const firstMs = Date.parse(firstReport);
  return Number.isFinite(firstMs) ? vnMidnightMs(vnDayAt(firstMs)) + DAY_MS + 3*60*60_000 : NaN;
}

function storeSystemEvent(
  state: DurableObjectState, batchId: string, eventType: string,
  payload: Record<string, unknown>, now: string,
): string {
  const id = crypto.randomUUID();
  state.storage.sql.exec(
    `INSERT INTO report_events (event_id,batch_id,ticket_id,event_type,actor_user_id,actor_employee_code,payload_json,created_at)
      VALUES (?,?,NULL,?,?,NULL,?,?)`,
    id,batchId,eventType,SYSTEM_ACTOR,JSON.stringify(payload),now,
  );
  return id;
}

function audit(
  state: DurableObjectState, batchId: string, action: string,
  metadata: Record<string, unknown>, now: string,
): void {
  state.storage.sql.exec(
    `INSERT INTO audit_log (audit_id,actor_user_id,actor_employee_code,action,target_type,target_id,metadata_json,created_at)
      VALUES (?, ?, NULL, ?, 'REPORT_BATCH', ?, ?, ?)`,
    crypto.randomUUID(),SYSTEM_ACTOR,action,batchId,JSON.stringify(metadata),now,
  );
}

function reminded(state: DurableObjectState, id: string, level: number): boolean {
  return Boolean(one(state.storage.sql.exec<SqlRow>(
    "SELECT 1 AS found FROM d167_overdue_reminder_events WHERE batch_id = ? AND level = ? LIMIT 1",
    id, level,
  ).toArray()));
}

function reminderTime(state: DurableObjectState, atMs: number): number {
  // Reminders keep elapsed wall time (+30/+60), but presentation is deferred to
  // end of a meal if the reminder would interrupt a confirmed/safe lunch window.
  const slots = mealWindowsBetween(state,atMs-86_400_000,atMs+86_400_000);
  const meal = slots.find(slot => atMs>=slot.from && atMs<slot.to);
  return meal ? meal.to : atMs;
}

function issueReminder(state: DurableObjectState, row: SqlRow, level: 30|60, nowMs: number): OperationalDeadlineEffect | null {
  const batchId=String(row.batch_id || "");
  const overdue=Date.parse(String(row.d167_first_overdue_at||""));
  if (!batchId||!Number.isFinite(overdue)) return null;
  if (reminderTime(state,overdue+level*60_000) > nowMs) return null;
  let accepted=false; let id="";
  const now=new Date(nowMs).toISOString();
  state.storage.transactionSync(()=>{
    const latest=one(state.storage.sql.exec<SqlRow>(
      "SELECT status FROM report_batches WHERE batch_id=? LIMIT 1",batchId,
    ).toArray());
    if(String(latest?.status||"")!=="PENDING" || reminded(state,batchId,level))return;
    state.storage.sql.exec(
      "INSERT OR IGNORE INTO d167_overdue_reminder_events (batch_id,level,created_at) VALUES (?,?,?)",
      batchId,level,now,
    );
    accepted=true;
    id=storeSystemEvent(state,batchId,"D167_OVERDUE_REMINDER_"+level,{
      first_overdue_at:String(row.d167_first_overdue_at||""),level_minutes:level,source:"SYSTEM_REMINDER"
    },now);
    state.storage.sql.exec(
      "UPDATE d167_overdue_reminder_events SET event_id=? WHERE batch_id=? AND level=?",
      id,batchId,level
    );
    audit(state,batchId,"D167_OVERDUE_REMINDER_"+level,{level_minutes:level},now);
  });
  if(!accepted)return null;
  return {
    event:level===30?"d167_overdue_reminder_30":"d167_overdue_reminder_60",
    event_id:id,batch_id:batchId,sku:String(row.sku||""),
    product_name:String(row.product_name||""),
    scopes:["reporter_overdue"],reporter_roles:["REPORTER","ADMIN","ROOT"],
    picker_user_ids:[],result_event:false,
    title:level===30?"SUPRA Inventory · Quá hạn nghiêm trọng":"SUPRA Inventory · Quá hạn chưa xử lý lần 2",
    body:`SKU ${String(row.sku||"")} chưa được Reporter chốt kết quả sau ${level} phút quá hạn. Vui lòng kiểm tra.`,
  };
}

export function processD167OverdueReminders(
  state: DurableObjectState, nowMs: number,
): OperationalDeadlineEffect[] {
  const out: OperationalDeadlineEffect[]=[];
  const active=state.storage.sql.exec<SqlRow>(
    `SELECT batch_id,sku,product_name,d167_first_overdue_at
       FROM report_batches
      WHERE status='PENDING' AND d167_first_overdue_at IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM report_tickets t
          WHERE t.batch_id = report_batches.batch_id AND t.status = 'OPEN'
            AND t.auto_skip_allowed_at IS NOT NULL
        )
      ORDER BY d167_first_overdue_at ASC LIMIT ?`,MAX_BATCHES*5,
  ).toArray();
  for(const row of active){
    const id=String(row.batch_id);
    const firstMs=Date.parse(String(row.d167_first_overdue_at));
    if(!Number.isFinite(firstMs))continue;
    const firstDone=reminded(state,id,30),secondDone=reminded(state,id,60);
    if(secondDone)continue;
    if(!firstDone && nowMs>=reminderTime(state,firstMs+ONE_HOUR_MS)){
      // Avoid two back-to-back notifications after a long offline period.
      state.storage.sql.exec(
        "INSERT OR IGNORE INTO d167_overdue_reminder_events (batch_id,level,created_at) VALUES (?,30,?)",
        id,new Date(nowMs).toISOString(),
      );
    }
    else if(!firstDone){
      const effect=issueReminder(state,row,30,nowMs);if(effect)out.push(effect);
      continue;
    }
    const effect=issueReminder(state,row,60,nowMs);if(effect)out.push(effect);
    if(out.length>=MAX_BATCHES)break;
  }
  return out;
}

export function processD167DayClose(
  state: DurableObjectState, nowMs: number,
): OperationalDeadlineEffect[] {
  const now=new Date(nowMs).toISOString();
  const candidates=state.storage.sql.exec<SqlRow>(
    `SELECT batch_id,sku,product_name,first_report_at,d167_first_overdue_at,version
       FROM report_batches WHERE status='PENDING'
         AND first_report_at <= ?
       ORDER BY first_report_at ASC LIMIT ?`,
    now,MAX_BATCHES*4,
  ).toArray();
  const out: OperationalDeadlineEffect[]=[];
  for(const row of candidates){
    const batchId=String(row.batch_id||"");
    if(!batchId||dayCloseAt(String(row.first_report_at||""))>nowMs)continue;
    const day=vnDayAt(Date.parse(String(row.first_report_at)));
    let effect:OperationalDeadlineEffect|null=null;
    state.storage.transactionSync(()=>{
      const latest=one(state.storage.sql.exec<SqlRow>(
        "SELECT status,d167_first_overdue_at,version FROM report_batches WHERE batch_id=? LIMIT 1",
        batchId,
      ).toArray());
      if(latest?.status!=="PENDING")return;
      const count=one(state.storage.sql.exec<SqlRow>(
        `SELECT
           SUM(CASE WHEN status='OPEN' AND auto_skip_allowed_at IS NULL THEN 1 ELSE 0 END) AS waiting,
           SUM(CASE WHEN status='OPEN' AND auto_skip_allowed_at IS NOT NULL THEN 1 ELSE 0 END) AS overdue
         FROM report_tickets WHERE batch_id=?`,batchId,
      ).toArray())||{};
      const waiting=Number(count.waiting||0),overdue=Number(count.overdue||0);
      const waitingUsers=state.storage.sql.exec<SqlRow>(
        `SELECT DISTINCT picker_user_id AS id FROM report_tickets
          WHERE batch_id=? AND status='OPEN' AND auto_skip_allowed_at IS NULL AND picker_user_id IS NOT NULL`,
        batchId,
      ).toArray().map(r=>String(r.id||"")).filter(Boolean);
      state.storage.sql.exec(
        `UPDATE report_tickets SET status='RESOLVED',resolution='SKIP_ALLOWED',
          resolution_source='SYSTEM_DAY_END',auto_skip_allowed_at=?,
          resolved_at=?,updated_at=?
         WHERE batch_id=? AND status='OPEN' AND auto_skip_allowed_at IS NULL`,
        now,now,now,batchId,
      );
      state.storage.sql.exec(
        `UPDATE report_tickets SET status='RESOLVED',resolution='SKIP_ALLOWED',resolution_source='SYSTEM_DAY_END',resolved_at=COALESCE(resolved_at,?),updated_at=?
         WHERE batch_id=? AND status='OPEN' AND auto_skip_allowed_at IS NOT NULL`,
        now,now,batchId,
      );
      const correctionDeadline=correctionDeadlineFromResult(state,now);
      state.storage.sql.exec(
        `UPDATE report_batches SET status='SKIP_ALLOWED',resolution='SKIP_ALLOWED',
          resolution_source='SYSTEM_DAY_END',resolved_at=?,resolved_by_user_id=NULL,
          correction_deadline_at=?,version=version+1,updated_at=?
          WHERE batch_id=? AND status='PENDING'`,
        now,correctionDeadline,now,batchId,
      );
      const newBatchVersion=one(state.storage.sql.exec<SqlRow>(
        "SELECT version FROM report_batches WHERE batch_id=? LIMIT 1",batchId
      ).toArray());
      const payload={
        resolution:"SKIP_ALLOWED",source:"SYSTEM_DAY_END",business_date_vn:day,
        first_overdue_at:String(latest.d167_first_overdue_at||""),
        waiting_picker_count:waiting,already_overdue_picker_count:overdue,
        queue_delta:waiting>0?-1:0,overdue_delta:overdue>0?-1:0,
        recent_counter:{before_status:null,before_at:null,after_status:"SKIP_ALLOWED",after_at:now},
      };
      const id=storeSystemEvent(state,batchId,"BATCH_DAY_END_AUTO_SKIP",payload,now);
      state.storage.sql.exec(
        `INSERT OR IGNORE INTO result_event_snapshots
        (result_event_id,batch_id,batch_version,event_type,sku,product_name,resolution,result_at,created_at)
        VALUES (?,?,?,?,? ,?,'SKIP_ALLOWED',?,?)`,
        id,batchId,Number(newBatchVersion?.version||1),"BATCH_DAY_END_AUTO_SKIP",
        String(row.sku||""),String(row.product_name||""),now,now,
      );
      audit(state,batchId,"BATCH_DAY_END_AUTO_SKIP",payload,now);
      effect={
        event:"batch_day_end_auto_skip",event_id:id,batch_id:batchId,
        sku:String(row.sku||""),product_name:String(row.product_name||""),
        scopes:["reporter_queue","reporter_overdue","reporter_recent","picker_reports"],
        reporter_roles:["REPORTER","ADMIN","ROOT"],
        picker_user_ids:waitingUsers,result_event:true,
        queue_delta:waiting>0?-1:0,overdue_delta:-1,
        recent_counter:{before_status:null,before_at:null,after_status:"SKIP_ALLOWED",after_at:now},
        title:"SUPRA Inventory · Tự chốt cuối ngày",
        body:`SKU ${String(row.sku||"")} được hệ thống cho phép Skip do Inventory chưa xử lý trong ngày ${day} (chốt 03:00).`,
      };
    });
    if(effect)out.push(effect);
    if(out.length>=MAX_BATCHES)break;
  }
  return out;
}

export function nextD167OverdueAlarmMs(state: DurableObjectState, nowMs=Date.now()):number|null{
  const due:number[]=[];
  const records=state.storage.sql.exec<SqlRow>(
    `SELECT batch_id,d167_first_overdue_at,first_report_at FROM report_batches WHERE status='PENDING' AND d167_first_overdue_at IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM report_tickets t
         WHERE t.batch_id = report_batches.batch_id AND t.status = 'OPEN'
           AND t.auto_skip_allowed_at IS NOT NULL
       )
       ORDER BY d167_first_overdue_at LIMIT 250`,
  ).toArray();
  const effective=startAt(state);
  // Day-close must be armed for every pending batch, not only overdue batches.
  const firstPending=one(state.storage.sql.exec<SqlRow>(
    "SELECT first_report_at FROM report_batches WHERE status='PENDING' ORDER BY first_report_at LIMIT 1",
  ).toArray());
  if (firstPending?.first_report_at) {
    const close=dayCloseAt(String(firstPending.first_report_at));
    if (Number.isFinite(close)) due.push(close);
  }
  for(const row of records){
    const id=String(row.batch_id||""), firstMs=Date.parse(String(row.d167_first_overdue_at||""));
    if(!Number.isFinite(firstMs))continue;
    if(!reminded(state,id,30))due.push(reminderTime(state,firstMs+HALF_HOUR_MS));
    if(!reminded(state,id,60))due.push(reminderTime(state,firstMs+ONE_HOUR_MS));
    if(String(row.first_report_at||"")>=effective) {
      const terminal=dayCloseAt(String(row.first_report_at||""));
      if(Number.isFinite(terminal))due.push(terminal);
    }
  }
  return due.length?Math.min(...due):null;
}

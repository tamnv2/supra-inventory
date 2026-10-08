// D166 Cloudflare Usage bridge: on-demand, read-only, Inventory Beta only.
// No tokens, account identifiers or raw provider payloads leave this Worker.
export interface D166CfEnv {
  D166_CF_READ_TOKEN?: string;
  D166_CF_ACCOUNT_ID?: string;
}
type Hourly = { hour_start_utc: string; requests: number | null; errors: number | null; subrequests: number | null };
type Section = {status:string;scope:string;source:string; hourly?:Hourly[]; metrics?:Array<Record<string,unknown>>; rows?:number; note?:string};
const WORKER = 'supra-inventory-beta';
const CF = 'https://api.cloudflare.com/client/v4';
const HOUR = 3_600_000;
const MAX_HOURS = 25;
function num(value:unknown): number|null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
async function readApi(url:string, key:string, query?:Record<string,unknown>):Promise<{ok:boolean; status:string; body?:Record<string,unknown>}>{
  try {
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12_000);
    let response:Response;
    try {
      response=await fetch(url,{
        method:query?'POST':'GET',
        headers:{authorization:'Bearer '+key,accept:'application/json',...(query?{'content-type':'application/json'}:{})},
        ...(query?{body:JSON.stringify(query)}:{}),
        signal:controller.signal,
      });
    } finally {clearTimeout(timeout);}
    if (!response.ok) return {ok:false,status:'HTTP_'+response.status};
    const body=await response.json() as Record<string,unknown>;
    if (body.success===false || (Array.isArray(body.errors) && body.errors.length>0))
      return {ok:false,status:'PROVIDER_ERROR'};
    return {ok:true,status:'OK',body};
  } catch {return {ok:false,status:'UNAVAILABLE'};}
}
function hoursBetween(start:Date,end:Date): Array<{alias:string;at:Date;until:Date}> {
  const out:Array<{alias:string;at:Date;until:Date}>=[];
  let cursor=Math.floor(start.getTime()/HOUR)*HOUR;
  while(cursor<end.getTime() && out.length<MAX_HOURS){
    const at=new Date(Math.max(cursor,start.getTime()));
    const until=new Date(Math.min(cursor+HOUR,end.getTime()));
    out.push({alias:'hour'+out.length,at,until});
    cursor+=HOUR;
  }
  return out;
}
export async function collectD166Cf(env:D166CfEnv,start:Date,end:Date):Promise<{
  workers:Section;durable_objects_account:Section;billing_account:Section;collection:{requests:number;token_present:boolean}
}> {
  const missing:Section={status:'NOT_CONFIGURED',scope:'INVENTORY_BETA_WORKER_ONLY',source:'CLOUDFLARE'};
  const noDo:Section={status:'NAMESPACE_NOT_CANONICALLY_SCOPED',scope:'SHARED_ACCOUNT_NOT_QUERIED',source:'CLOUDFLARE',note:'InventoryCore namespace identifier not registered; account DO data is excluded'};
  const account=String(env.D166_CF_ACCOUNT_ID||'');
  const key=String(env.D166_CF_READ_TOKEN||'');
  if (!/^[a-f0-9]{32}$/i.test(account) || key.length<20)
    return {workers:missing,durable_objects_account:noDo,billing_account:{...missing,scope:'SHARED_ACCOUNT_UNATTRIBUTABLE'},collection:{requests:0,token_present:false}};
  const buckets=hoursBetween(start,end);
  if (!buckets.length || buckets.length>MAX_HOURS)
    return {workers:{...missing,status:'INVALID_RANGE'},durable_objects_account:noDo,billing_account:{...missing,status:'INVALID_RANGE'},collection:{requests:0,token_present:true}};
  // One bounded GraphQL call, one alias per hour. This dataset's official name
  // is workersInvocationsAdaptive (NOT workersInvocationsAdaptiveGroups).
  // Avoid dimensions and request sum only: each alias aggregates its own hour.
  const fields=buckets.map(h=>
    h.alias+':workersInvocationsAdaptive(limit:1,filter:{scriptName:"'+WORKER+'",datetime_geq:"'+h.at.toISOString()+'",datetime_leq:"'+new Date(h.until.getTime()-1).toISOString()+'"}){sum{requests errors subrequests}}'
  ).join(' ');
  const graphql='query($accountTag:string){viewer{accounts(filter:{accountTag:$accountTag}){'+fields+'}}}';
  const cf=await readApi(CF+'/graphql',key,{query:graphql,variables:{accountTag:account}});
  let workers:Section={status:cf.status,scope:'INVENTORY_BETA_WORKER_ONLY',source:'CLOUDFLARE_GRAPHQL'};
  if(cf.ok){
    const viewer=cf.body?.data as Record<string,unknown>|undefined;
    const accounts=((viewer?.viewer as Record<string,unknown>|undefined)?.accounts||[]) as Array<Record<string,unknown>>;
    if(accounts.length!==1) workers.status='ACCOUNT_SCOPE_ERROR';
    else{
      const hourly:Hourly[]=[];
      let partial=false;
      for(const h of buckets){
        const records=accounts[0][h.alias];
        if(!Array.isArray(records)||records.length>1){partial=true;continue;}
        if(records.length===0){hourly.push({hour_start_utc:new Date(Math.floor(h.at.getTime()/HOUR)*HOUR).toISOString(),requests:0,errors:0,subrequests:0});continue;}
        const row=records[0] as Record<string,unknown>;
        const sums=(row.sum||{}) as Record<string,unknown>;
        hourly.push({hour_start_utc:new Date(Math.floor(h.at.getTime()/HOUR)*HOUR).toISOString(),
          requests:num(sums.requests),errors:num(sums.errors),subrequests:num(sums.subrequests)});
      }
      workers={status:partial?'PARTIAL':hourly.length?'OK':'NO_DATA',scope:'INVENTORY_BETA_WORKER_ONLY',
        source:'CLOUDFLARE_GRAPHQL',hourly,rows:hourly.length,note:'Cloudflare analytics may be sampled or delayed; hour boundaries UTC'};
    }
  }
  const billingRes=await readApi(CF+'/accounts/'+account+'/billable-usage',key);
  let billing:Section={status:billingRes.status,scope:'SHARED_ACCOUNT_UNATTRIBUTABLE',source:'CLOUDFLARE_BILLABLE_USAGE_V1',
    note:'Account aggregates not Inventory expenses; provider usage may lag and is not invoice'};
  if(billingRes.ok){
    const rows=billingRes.body?.result;
    if(Array.isArray(rows)){
      billing.status=rows.length>200?'TRUNCATED':rows.length?'OK':'NO_DATA';
      billing.rows=rows.length;
      billing.metrics=rows.slice(0,200).filter((v:unknown)=>{const x=v as Record<string,unknown>; return /workers|durable object/i.test(String(x.ServiceFamilyName||'')+' '+String(x.ServiceName||''));}).map((v:unknown)=>{
        const x=v as Record<string,unknown>;
        return {metric_id:String(x.x_BillableMetricId||'').slice(0,100),
          description:String(x.ChargeDescription||'').slice(0,140),
          start:String(x.ChargePeriodStart||'').slice(0,32),
          end:String(x.ChargePeriodEnd||'').slice(0,32),
          quantity:num(x.ConsumedQuantity),
          unit:String(x.ConsumedUnit||'').slice(0,40),
          billed_cost:num(x.BilledCost),currency:String(x.BillingCurrency||'').slice(0,10)};
      });
    } else billing.status='UNSUPPORTED_RESPONSE';
  }
  return {workers,durable_objects_account:noDo,billing_account:billing,
    collection:{requests:2,token_present:true}};
}

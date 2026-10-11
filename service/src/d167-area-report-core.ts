/**
 * D167 report-day cohort + verified LTA/Shelving as-of attribution.
 * Read-only SQL, bounded date window, no per-SKU/WMS provider traffic.
 */
type SqlRow = Record<string, SqlStorageValue>;
const send = (payload: unknown, status=200) => new Response(JSON.stringify(payload), {
  status, headers: { "content-type":"application/json","cache-control":"no-store" },
});
function dayAt(ms:number):string { return new Date(ms+7*3600_000).toISOString().slice(0,10); }
function validateRange(url:URL):{start:string;end:string}|null {
  const now=Date.now();
  const end=url.searchParams.get("to") || dayAt(now);
  const start=url.searchParams.get("from") || end;
  const pattern=/^\d{4}-\d{2}-\d{2}$/;
  if(!pattern.test(start)||!pattern.test(end))return null;
  const a=Date.parse(start+"T00:00:00Z"),b=Date.parse(end+"T00:00:00Z");
  if(!Number.isFinite(a)||!Number.isFinite(b)||start!==new Date(a).toISOString().slice(0,10)
    ||end!==new Date(b).toISOString().slice(0,10)||a>b||b-a>59*86400_000)return null;
  return {start,end};
}
const AS_OF_AREA=`COALESCE((SELECT area FROM d167_sku_area_history h
  WHERE h.sku=b.sku AND h.effective_from<=b.first_report_at
    AND (h.effective_to IS NULL OR h.effective_to>b.first_report_at)
  ORDER BY h.effective_from DESC LIMIT 1),'UNKNOWN')`;
function scopedSql(where:string):string {
  return `SELECT b.batch_id,b.sku,b.product_name,b.business_day_vn,b.first_report_at,
    b.status,b.resolved_at,b.resolved_by_user_id,
    ${AS_OF_AREA} AS area_at_first_report,
    (SELECT COUNT(*) FROM report_tickets t WHERE t.batch_id=b.batch_id) AS picker_report_count,
    (SELECT COUNT(DISTINCT t.picker_employee_code)
       FROM report_tickets t WHERE t.batch_id=b.batch_id) AS unique_picker_count
    FROM report_batches b WHERE b.business_day_vn>=? AND b.business_day_vn<=? ${where}`;
}
export async function handleD167AreaReportCoreRequest(
  state:DurableObjectState,request:Request,
):Promise<Response|null> {
  const url=new URL(request.url);
  if(!url.pathname.startsWith("/d167/report/"))return null;
  if(request.method!=="GET")return send({error:"METHOD_NOT_ALLOWED"},405);
  const kind=url.pathname.slice("/d167/report/".length);
  if(kind==="timeline"){
    const sku=String(url.searchParams.get("sku")||"").trim();
    if(!sku||sku.length>128)return send({error:"INVALID_SKU"},400);
    const items=state.storage.sql.exec<SqlRow>(
      "SELECT sku,area,effective_from,effective_to,day_vn,source_slot FROM d167_sku_area_history WHERE sku=? ORDER BY effective_from DESC LIMIT 500",sku).toArray();
    return send({sku,items,pre_observation_area:"UNKNOWN"});
  }
  if(kind!=="summary"&&kind!=="detail")return send({error:"NOT_FOUND"},404);
  const range=validateRange(url);
  if(!range)return send({error:"INVALID_REPORT_RANGE_MAX_60_DAYS"},400);
  const area=String(url.searchParams.get("area")||"ALL").toUpperCase();
  if(!["ALL","LTA","SHELVING","UNKNOWN"].includes(area))return send({error:"INVALID_AREA"},400);
  const status=String(url.searchParams.get("status")||"ALL").toUpperCase();
  if(!["ALL","PENDING","HAS_STOCK","SKIP_ALLOWED","CLOSED"].includes(status))return send({error:"INVALID_STATUS"},400);
  const sku=String(url.searchParams.get("sku")||"").trim();
  if(sku.length>128)return send({error:"INVALID_SKU"},400);
  const raw=scopedSql("");
  const args:SqlStorageValue[]=[range.start,range.end];
  let clauses:string[]=[];
  if(area!=="ALL")clauses.push("area_at_first_report=?");
  if(status!=="ALL")clauses.push("status=?");
  if(sku)clauses.push("sku=?");
  const filters=clauses.length?"WHERE "+clauses.join(" AND "):"";
  if(area!=="ALL")args.push(area);
  if(status!=="ALL")args.push(status);
  if(sku)args.push(sku);
  const query=`SELECT * FROM (${raw}) AS cohort ${filters}`;
  const summary=state.storage.sql.exec<SqlRow>(`
    SELECT area_at_first_report AS area,
      COUNT(*) AS batches,
      COUNT(DISTINCT sku) AS distinct_skus,
      SUM(picker_report_count) AS picker_reports,
      SUM(CASE WHEN status='HAS_STOCK' THEN 1 ELSE 0 END) AS has_stock,
      SUM(CASE WHEN status='SKIP_ALLOWED' THEN 1 ELSE 0 END) AS skip_allowed,
      SUM(CASE WHEN status='CLOSED' THEN 1 ELSE 0 END) AS closed,
      SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) AS pending
    FROM (${query}) summary_cohort GROUP BY area_at_first_report
    ORDER BY area_at_first_report`,...args).toArray();
  if(kind==="summary")return send({
    from_vn:range.start,to_vn:range.end,generated_at:new Date().toISOString(),
    area_filter:area,status_filter:status,areas:summary,
    totals:summary.reduce((a,x)=>({
      batches:a.batches+Number(x.batches||0),picker_reports:a.picker_reports+Number(x.picker_reports||0)
    }),{batches:0,picker_reports:0}),
    area_evidence:"VERIFIED_AS_OF_FIRST_REPORT_OR_UNKNOWN",
  });
  const limit=Math.max(1,Math.min(200,Number(url.searchParams.get("limit")||100)));
  const offset=Math.max(0,Math.min(100_000,Number(url.searchParams.get("offset")||0)));
  const items=state.storage.sql.exec<SqlRow>(
    `${query} ORDER BY first_report_at DESC,batch_id DESC LIMIT ? OFFSET ?`,
    ...args,limit,offset).toArray();
  const totalRow=state.storage.sql.exec<{n:number}>(`SELECT COUNT(*) AS n FROM (${query})`,...args).toArray()[0];
  return send({from_vn:range.start,to_vn:range.end,generated_at:new Date().toISOString(),
    area_filter:area,status_filter:status,items,count:items.length,total:Number(totalRow?.n||0),
    limit,offset,areas:summary});
}

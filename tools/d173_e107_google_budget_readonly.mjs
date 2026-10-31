// Existing registered Firestore Monitoring only. Four network requests maximum;
// credentials/JWT/token and raw series never reach stdout, files or artifacts.
import crypto from 'node:crypto';
import fs from 'node:fs';

const output = {schema:'D173_E107_FIRESTORE_BUDGET_RESEARCH_V1',
  financial_pass:false, production_mutations:false, provider_requests_max:4};
const number = x => { const n=Number(x);return Number.isFinite(n)&&n>=0?n:null; };
const dayAt = (at,zone) => new Intl.DateTimeFormat('en-CA',{
  timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
const encoded = data => Buffer.from(JSON.stringify(data)).toString('base64url');
async function json(url, options={}) {
  try {
    const r=await fetch(url,{...options,signal:AbortSignal.timeout(25000)});
    if(!r.ok)return {status:'HTTP_'+r.status};
    const raw=await r.text();
    if(raw.length>4*1024*1024)return {status:'RESPONSE_TOO_LARGE'};
    return {status:'HTTP_200',data:JSON.parse(raw)};
  } catch {return {status:'NETWORK_OR_JSON_UNAVAILABLE'};}
}

if(process.env.E107_SELFTEST==='1') {
  if(dayAt(Date.parse('2026-10-30T06:30:00Z'),'America/Los_Angeles')!=='2026-10-29')throw Error('PACIFIC_BOUNDARY');
  if(dayAt(Date.parse('2026-10-30T07:30:00Z'),'America/Los_Angeles')!=='2026-10-30')throw Error('PACIFIC_BOUNDARY');
  console.log('E107_GOOGLE_READONLY_SELFTEST_PASS');
} else {
  try {
    const c=JSON.parse(process.env.GOOGLE_RUNTIME_SA_JSON||'{}');
    if(c.project_id!=='supra-inventory-beta'||!c.client_email||!c.private_key) {
      output.status='EXISTING_READ_CREDENTIALS_UNAVAILABLE';
    } else {
      const now=Math.floor(Date.now()/1000);
      const input=encoded({alg:'RS256',typ:'JWT'})+'.'+encoded({iss:c.client_email,
        scope:'https://www.googleapis.com/auth/monitoring.read',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
      const jwt=input+'.'+crypto.sign('RSA-SHA256',Buffer.from(input),c.private_key).toString('base64url');
      const auth=await json('https://oauth2.googleapis.com/token',{method:'POST',
        headers:{'content-type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt})});
      if(!auth.data?.access_token)output.status=auth.status+'_NO_MONITORING_TOKEN';
      else {
        const end=new Date(),start=new Date(end.getTime()-72*3600000);
        output.window={start:start.toISOString(),end:end.toISOString()};
        output.metrics={};
        for(const [id,name] of [['reads','read_ops_count'],['writes','write_ops_count'],['deletes','delete_ops_count']]) {
          const q=new URLSearchParams({filter:'metric.type="firestore.googleapis.com/document/'+name+'"',
            'interval.startTime':start.toISOString(),'interval.endTime':end.toISOString(),view:'FULL',pageSize:'1000',
            'aggregation.alignmentPeriod':'3600s','aggregation.perSeriesAligner':'ALIGN_SUM'});
          const r=await json('https://monitoring.googleapis.com/v3/projects/supra-inventory-beta/timeSeries?'+q,
            {headers:{authorization:'Bearer '+auth.data.access_token}});
          const series=r.data?.timeSeries;
          if(!Array.isArray(series)||r.data?.nextPageToken) {
            output.metrics[id]={status:r.data?.nextPageToken?'TRUNCATED':r.status+'_NO_DATA'};continue;
          }
          const hourly=new Map();let unknown=0,used=0;
          for(const s of series) {
            const db=s.resource?.labels?.database_id;
            if(db!=='(default)'){unknown++;continue;}
            used++;
            for(const p of s.points||[]) {
              const n=number(p.value?.int64Value??p.value?.doubleValue);
              const t=Date.parse(p.interval?.endTime||'');
              if(n===null||!Number.isFinite(t))continue;
              const hour=t-3600000;hourly.set(hour,(hourly.get(hour)||0)+n);
            }
          }
          const summaries={};
          for(const [label,zone] of [['vn','Asia/Ho_Chi_Minh'],['quota_pacific','America/Los_Angeles']]) {
            const days={};
            for(const [hour,n] of hourly) {
              const d=dayAt(hour+1800000,zone);const row=days[d]??={operations:0,hours:0};
              row.operations+=n;row.hours++;
            }
            summaries[label]=days;
          }
          output.metrics[id]={status:used?'OBSERVED_NOT_INVOICE':'DATABASE_SCOPE_UNVERIFIED',
            known_default_series:used,omitted_unknown_database_series:unknown,...summaries};
        }
        output.status='RESEARCH_COMPLETE_NOT_FINANCIAL_ACCEPTANCE';
      }
    }
  } catch {output.status='CREDENTIAL_OR_PROVIDER_UNAVAILABLE';}
  fs.writeFileSync('d173-e107-firestore-budget-readonly.json',JSON.stringify(output,null,2)+'\n');
  console.log('E107_GOOGLE_STATUS='+output.status);
}

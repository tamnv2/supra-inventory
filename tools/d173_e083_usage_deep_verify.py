#!/usr/bin/env python3
"""D173-E083 source equivalence and billing evidence, one-shot, READ ONLY.
No secrets, quantities, provider payloads, account/resource identifiers or raw error bodies in logs.
"""
import datetime as dt, json, os, urllib.parse, urllib.request, urllib.error, math
from pathlib import Path
UTC=dt.timezone.utc
NOW=dt.datetime.now(UTC)
CUTOFF=NOW-dt.timedelta(minutes=75)
DAYS=(NOW-dt.timedelta(days=1)).strftime("%Y-%m-%d")
ALLOW=("fcm.googleapis.com","identitytoolkit.googleapis.com","securetoken.googleapis.com","drive.googleapis.com","sheets.googleapis.com")
EVIDENCE={"schema":"D173_E083_DEEP_READONLY_V1","timestamp_utc":NOW.isoformat(),"requests":0}
def fetch(url,token,payload=None,gcp=False):
    if not token:return ("NO_CREDENTIALS",None)
    headers={"Authorization":"Bearer "+token,"Accept":"application/json"}
    if payload is not None:headers["Content-Type"]="application/json"
    if gcp:headers["X-Goog-User-Project"]="supra-inventory-beta"
    req=urllib.request.Request(url,headers=headers,
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        method="POST" if payload is not None else "GET")
    EVIDENCE["requests"]+=1
    try:
        with urllib.request.urlopen(req,timeout=20) as rsp:return ("OK",json.load(rsp))
    except urllib.error.HTTPError as err:
        return ("HTTP_"+str(err.code),None)
    except Exception:return ("NETWORK_ERROR",None)
def num(x):
    try:
        if isinstance(x,(int,float,str)) and not isinstance(x,bool):
            v=float(x)
            if math.isfinite(v) and v>=0:return v
    except (ValueError,TypeError):pass
    return None
def stamps(rows,alias,field):
    out={}
    if not isinstance(rows,list):return None
    for entry in rows:
        if not isinstance(entry,dict):continue
        time=str((entry.get("dimensions") or {}).get("datetimeFiveMinutes") or "")
        value=num(((entry.get(alias) or {}).get(field)))
        if time and value is not None:out[time]=out.get(time,0)+value
    return out
def eq_metric(grouped,individual):
    if grouped is None or individual is None:return "NO_DATASET"
    if not grouped and not individual:return "BOTH_EMPTY"
    if set(grouped)!=set(individual):return "BUCKET_MISMATCH"
    if all(abs(grouped[k]-individual[k])<=max(0.5,0.025*max(grouped[k],individual[k])) for k in grouped):
        return "EQUIVALENT_TOL_2_5PCT"
    return "VALUES_DIFFER"
def cf():
    token=os.getenv("D166_CF_READ_TOKEN","")
    acct=os.getenv("CF_ACCOUNT_ID","")
    if not token or len(acct)!=32:return {"status":"NO_CREDENTIALS"}
    start=CUTOFF.strftime("%Y-%m-%dT%H:%M:%SZ")
    def q(fields):
        return '{viewer{accounts(filter:{accountTag:"'+acct+'"}){'+fields+'}}}'
    day='filter:{date_geq:"'+DAYS+'"},limit:1000'
    worker='filter:{scriptName:"supra-inventory-beta",datetime_geq:"'+start+'"},limit:1000'
    d='d:durableObjectsPeriodicGroups('+day+'){dimensions{datetimeFiveMinutes} sum{rowsRead rowsWritten duration}}'
    r='r:durableObjectsInvocationsAdaptiveGroups('+day+'){dimensions{datetimeFiveMinutes} sum{requests}}'
    w='w:workersInvocationsAdaptive('+worker+'){dimensions{datetimeFiveMinutes} sum{requests cpuTimeUs}}'
    u="https://api.cloudflare.com/client/v4/graphql"
    status,merged=fetch(u,token,{"query":q(" ".join((d,r,w)))})
    if status!="OK":return {"status":status}
    if not isinstance(merged,dict) or merged.get("errors"):return {"status":"SCHEMA_OR_PERMISSION"}
    m=(((merged.get("data") or {}).get("viewer") or {}).get("accounts") or [])
    if len(m)!=1:return {"status":"SCOPE_UNVERIFIED"}
    source=m[0]
    # Exact same filters, interval and fields; separate network calls for comparison.
    cmp={}
    for key,sub in (("d",d),("r",r),("w",w)):
        s,body=fetch(u,token,{"query":q(sub)})
        if s!="OK" or not isinstance(body,dict) or body.get("errors"):
            cmp[key]={"status":"INDIVIDUAL_ERROR" if s=="OK" else s}
            continue
        arr=(((body.get("data") or {}).get("viewer") or {}).get("accounts") or [])
        if len(arr)!=1:cmp[key]={"status":"SCOPE_UNVERIFIED"};continue
        old=arr[0].get(key)
        new=source.get(key)
        fields=("rowsRead","rowsWritten","duration") if key=="d" else ("requests",) if key=="r" else ("requests","cpuTimeUs")
        col="sum"
        matches={field:eq_metric(stamps(new,col,field),stamps(old,col,field)) for field in fields}
        cmp[key]={"status":"MATCH" if all(x in ("BOTH_EMPTY","EQUIVALENT_TOL_2_5PCT") for x in matches.values()) else "MISMATCH",
                  "metric_checks":matches,"group_buckets":len(new) if isinstance(new,list) else None,
                  "separate_buckets":len(old) if isinstance(old,list) else None,
                  "possible_truncation":len(new)>=1000 or len(old)>=1000 if isinstance(new,list) and isinstance(old,list) else None}
    return {"status":"GROUPING_COMPARED","nodes":cmp}
def gcp_raw(service=None):
    token=os.getenv("GCP_ACCESS_TOKEN","")
    if not token:return ("NO_CREDENTIALS",[],False,0)
    filt='metric.type="serviceruntime.googleapis.com/api/request_count" AND resource.type="consumed_api"'
    if service:filt+=' AND resource.labels.service="'+service+'"'
    params={"filter":filt,"interval.startTime":CUTOFF.isoformat(),
        "interval.endTime":NOW.isoformat(),"view":"FULL","pageSize":"1000",
        "aggregation.alignmentPeriod":"300s","aggregation.perSeriesAligner":"ALIGN_SUM"}
    entries=[];page="";queries=0
    for i in range(8):
        if page:params["pageToken"]=page
        url="https://monitoring.googleapis.com/v3/projects/supra-inventory-beta/timeSeries?"+urllib.parse.urlencode(params)
        s,payload=fetch(url,token,gcp=True);queries+=1
        if s!="OK":return (s,entries,False,queries)
        if not isinstance(payload,dict) or not isinstance(payload.get("timeSeries",[]),list):
            return ("MALFORMED",entries,False,queries)
        entries.extend(payload.get("timeSeries") or [])
        page=str(payload.get("nextPageToken") or "")
        if not page:return ("PASS",entries,False,queries)
    return ("TRUNCATED",entries,True,queries)
def gcp_sum(rows,service):
    d={}
    for series in rows:
        if ((series.get("resource") or {}).get("labels") or {}).get("service")!=service:continue
        for p in series.get("points") or []:
            key=((p.get("interval") or {}).get("endTime") or "")
            raw=p.get("value") or {}
            n=num(raw.get("int64Value",raw.get("doubleValue")))
            if key and n is not None:d[key]=d.get(key,0)+n
    return d
def gcp():
    status,group,more,pages=gcp_raw()
    if status!="PASS":return {"status":status,"query_pages":pages}
    out={}
    for service in ALLOW:
        s,rows,sp,pc=gcp_raw(service)
        if s!="PASS":out[service]={"status":s,"pages":pc};continue
        pair=eq_metric(gcp_sum(group,service),gcp_sum(rows,service))
        out[service]={"status":pair,"pages":pc,"individual_series":len(rows),
                      "grouped_series":sum(1 for v in group if
                          ((v.get("resource") or {}).get("labels") or {}).get("service")==service)}
    return {"status":"GROUPING_COMPARED","group_pages":pages,"group_series":len(group),"services":out}
def billing():
    token=os.getenv("D166_CF_READ_TOKEN","")
    account=os.getenv("CF_ACCOUNT_ID","")
    if not token or len(account)!=32:return {"status":"NO_CREDENTIALS"}
    base="https://api.cloudflare.com/client/v4/accounts/"+account
    info_status,info=fetch(base+"/billable-usage/info",token)
    snap_status,snap=fetch(base+"/billable-usage",token)
    v2_status,v2=fetch(base+"/billable/usage",token)
    subs_status,subs=fetch(base+"/subscriptions",token)
    # Return metadata validity, NEVER actual amounts/cost/private billing ID.
    result={"info_status":info_status,"v1_status":snap_status,"v2_status":v2_status,"subscription_listing_status":subs_status}
    if info_status=="OK" and isinstance(info,dict):
        obj=info.get("result") or {}
        if isinstance(obj,dict):
            periods=obj.get("subscriptions") or []
            result["subscription_count"]=len(periods) if isinstance(periods,list) else None
            result["has_anchor"]=bool(isinstance(periods,list) and any(x.get("billing_cycle_anchor_timestamp") for x in periods if isinstance(x,dict)))
            # end_timestamp is optional for active subscriptions: it is cancellation end, not a billing-cycle end.
            result["has_cycle_boundaries"]=bool(isinstance(periods,list) and any(
                (x.get("start_timestamp") or x.get("billing_cycle_anchor_timestamp")) and x.get("end_timestamp")
                for x in periods if isinstance(x,dict)))
    if snap_status=="OK" and isinstance(snap,dict):
        data=snap.get("result")
        result["v1_records"]=len(data) if isinstance(data,list) else None
        result["has_billing_period_start"]=bool(isinstance(data,list) and any(isinstance(x,dict) and x.get("BillingPeriodStart") for x in data))
        result["has_numeric_billed_cost"]=bool(isinstance(data,list) and any(isinstance(x,dict) and num(x.get("BilledCost")) is not None for x in data))
        result["workers_billed_cost_record"]=bool(isinstance(data,list) and any(isinstance(x,dict) and "worker" in (str(x.get("ServiceName") or "")+" "+str(x.get("ServiceFamilyName") or "")+" "+str(x.get("ChargeDescription") or "")).lower() and num(x.get("BilledCost")) is not None for x in data))
        result["storage_record_valid_quantity_unit"]=bool(isinstance(data,list) and any(
            isinstance(x,dict) and "durable" in
            (str(x.get("ServiceName") or "")+" "+str(x.get("ServiceFamilyName") or "")).lower() and
            "storage" in
            (str(x.get("ChargeDescription") or "")+" "+str(x.get("x_BillableMetricId") or "")).lower() and
            num(x.get("ConsumedQuantity")) is not None and bool(x.get("ConsumedUnit"))
            for x in data))
    if subs_status=="OK" and isinstance(subs,dict):
        entries=subs.get("result")
        result["worker_plan_current_period_bounds"]=bool(isinstance(entries,list) and any(
            isinstance(x,dict) and "worker" in (str(x.get("rate_plan") or "")+" "+str(x.get("name") or "")).lower() and x.get("frequency")=="monthly" and x.get("current_period_start") and x.get("current_period_end") for x in entries))
        result["has_current_period_bounds"]=bool(isinstance(entries,list) and any(
            isinstance(x,dict) and x.get("current_period_start") and x.get("current_period_end")
            and x.get("frequency") in ("monthly","quarterly","yearly") for x in entries))
    if v2_status=="OK" and isinstance(v2,dict):
        result["v2_records"]=len(v2.get("result")) if isinstance(v2.get("result"),list) else None
    return result
def selftest():
    assert eq_metric({"a":100},{"a":100})=="EQUIVALENT_TOL_2_5PCT"
    assert eq_metric({"a":1},{"b":1})=="BUCKET_MISMATCH"
    assert eq_metric({}, {})=="BOTH_EMPTY"
    assert eq_metric({"a":10},{"a":20})=="VALUES_DIFFER"
    assert len(ALLOW)==5
    print("E083_DEEP_OFFLINE_PASS")
def main():
    if os.getenv("E083_SELFTEST")=="1":selftest();return
    EVIDENCE["cloudflare"]=cf()
    EVIDENCE["gcp"]=gcp()
    EVIDENCE["billing"]=billing()
    Path("d173-e083-deep-evidence.json").write_text(json.dumps(EVIDENCE,indent=2)+"\n",encoding="utf8")
    print("E083_DEEP_CF="+EVIDENCE["cloudflare"]["status"])
    for k,v in EVIDENCE["cloudflare"].get("nodes",{}).items():
        print("E083_DEEP_CF_"+k+"="+v["status"]+" DETAILS="+",".join(v["metric_checks"].values())+
              " TRUNCATION="+str(v.get("possible_truncation")))
    print("E083_DEEP_GCP="+EVIDENCE["gcp"]["status"])
    for k,v in EVIDENCE["gcp"].get("services",{}).items():
        print("E083_DEEP_GCP_"+k+"="+v["status"]+" PAGES="+str(v.get("pages")))
    b=EVIDENCE["billing"]
    for key in ("info_status","v1_status","v2_status","has_anchor","has_cycle_boundaries","subscription_listing_status","has_current_period_bounds","worker_plan_current_period_bounds","has_billing_period_start","storage_record_valid_quantity_unit","has_numeric_billed_cost","workers_billed_cost_record"):
        print("E083_DEEP_BILLING_"+key+"="+str(b.get(key,"UNKNOWN")))
    print("E083_DEEP_OUTBOUND_REQUESTS="+str(EVIDENCE["requests"]))
if __name__=="__main__":main()

#!/usr/bin/env python3
"""D173-E085 one-shot Cloudflare read-only DO comparison. No Worker/DO/Firestore calls.
Outputs aggregated non-identifying metrics; no tokens, account IDs, request details, or raw error responses.
"""
import datetime as dt
import json
import os
import urllib.request
import urllib.error
from pathlib import Path

TZ = dt.timezone(dt.timedelta(hours=7))
UTC = dt.timezone.utc
DEPLOY_VN = dt.datetime(2026, 10, 27, 0, 38, tzinfo=TZ)
START = "2026-10-25"
OUT = Path("d173-e085-do-phase1-aggregate.json")
METRICS = ("rowsRead", "rowsWritten", "duration", "activeTime", "cpuTime", "inboundWebsocketMsgCount", "outboundWebsocketMsgCount", "subrequests")
INV = ("requests", "errors", "wallTime")
WORKER = ("requests", "errors", "cpuTimeUs")

def n(value):
    try:
        v = float(value)
        if not 0 <= v < 1e20:
            return 0.0
        return v
    except (TypeError, ValueError):
        return 0.0

def query():
    account = os.environ.get("CF_ACCOUNT_ID", "")
    token = os.environ.get("D166_CF_READ_TOKEN", "")
    if len(account) != 32 or not token:
        return "NO_READONLY_CREDENTIALS", {}
    # Hourly rollups avoid truncation for the 26-27 Oct VN matching windows.
    q = ('query{viewer{accounts(filter:{accountTag:"'+account+'"}){'
         'p:durableObjectsPeriodicGroups(filter:{date_geq:"'+START+'"},limit:1000){dimensions{datetimeHour}sum{'+ " ".join(METRICS)+'}}'
         'i:durableObjectsInvocationsAdaptiveGroups(filter:{date_geq:"'+START+'"},limit:1000){dimensions{datetimeHour status scriptName}sum{'+ " ".join(INV)+'}}'
         'w:workersInvocationsAdaptive(filter:{scriptName:"supra-inventory-beta",datetime_geq:"'+START+'T00:00:00Z"},limit:1000){dimensions{datetimeHour}sum{'+ " ".join(WORKER)+'}}'
         '}}}')
    request=urllib.request.Request(
        "https://api.cloudflare.com/client/v4/graphql", method="POST",
        headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"},
        data=json.dumps({"query":q}).encode("utf-8"))
    try:
        with urllib.request.urlopen(request,timeout=25) as response:
            body=json.load(response)
    except urllib.error.HTTPError as exc:
        return "HTTP_"+str(exc.code), {}
    except Exception:
        return "NETWORK_FAILURE", {}
    if body.get("errors"):
        return "SCHEMA_OR_PERMISSION", {}
    accounts=((body.get("data") or {}).get("viewer") or {}).get("accounts") or []
    if len(accounts)!=1:
        return "ACCOUNT_SCOPE_MISMATCH", {}
    return "OK", accounts[0]

def hourkey(row):
    s=(row.get("dimensions") or {}).get("datetimeHour")
    if not isinstance(s,str):
        return None
    try:
        d=dt.datetime.fromisoformat(s.replace("Z","+00:00")).astimezone(TZ)
        return (d.strftime("%Y-%m-%d"), d.hour)
    except ValueError:
        return None

def aggregate(source, now):
    if any(not isinstance(source.get(k),list) for k in ("p","i","w")):
        return {"status":"MISSING_DATASET"}
    sizes={k:len(source[k]) for k in ("p","i","w")}
    if any(v>=1000 for v in sizes.values()):
        return {"status":"TRUNCATED","datasets":sizes}
    allowed_days=("2026-10-26","2026-10-27")
    # E055 released at 00:38 VN 27th, so only compare complete clock hours 01..last complete hour.
    last_hour = min(22, now.hour-1) if now.strftime("%Y-%m-%d")=="2026-10-27" else 22
    if last_hour < 7:
        return {"status":"INSUFFICIENT_POST_RELEASE_WINDOW","datasets":sizes}
    hourly={}
    def target(day,h):
        key=day+"T"+str(h).zfill(2)
        if key not in hourly:
            hourly[key]={"day":day,"hour":h,"rowsRead":0,"rowsWritten":0,"duration":0,"activeTime":0,"cpuTime":0,
                         "inboundWebsocketMsgCount":0,"outboundWebsocketMsgCount":0,"subrequests":0,
                         "do_requests":0,"do_errors":0,"do_wallTime":0,"inventory_do_requests":0,
                         "worker_requests":0,"worker_errors":0,"worker_cpu_us":0,"statuses":{}}
        return hourly[key]
    for row in source["p"]:
        k=hourkey(row)
        if not k or k[0] not in allowed_days or not 1<=k[1]<=last_hour:continue
        v=target(*k); sm=row.get("sum") or {}
        for met in METRICS:v[met]+=n(sm.get(met))
    for row in source["i"]:
        k=hourkey(row)
        if not k or k[0] not in allowed_days or not 1<=k[1]<=last_hour:continue
        v=target(*k); sm=row.get("sum") or {}
        v["do_requests"]+=n(sm.get("requests"));v["do_errors"]+=n(sm.get("errors"));v["do_wallTime"]+=n(sm.get("wallTime"))
        d=row.get("dimensions") or {};name=d.get("scriptName")
        if name=="supra-inventory-beta":v["inventory_do_requests"]+=n(sm.get("requests"))
        status=str(d.get("status") or "unknown")
        # Do not write unknown provider status or identifiers to artifacts.
        status=status if status in ("success","clientDisconnected","scriptThrewException","exceededResources","internalError") else "other"
        v["statuses"][status]=v["statuses"].get(status,0)+n(sm.get("requests"))
    for row in source["w"]:
        k=hourkey(row)
        if not k or k[0] not in allowed_days or not 1<=k[1]<=last_hour:continue
        v=target(*k); sm=row.get("sum") or {}
        v["worker_requests"]+=n(sm.get("requests"));v["worker_errors"]+=n(sm.get("errors"));v["worker_cpu_us"]+=n(sm.get("cpuTimeUs"))
    fields=[*METRICS,"do_requests","do_errors","do_wallTime","inventory_do_requests","worker_requests","worker_errors","worker_cpu_us"]
    sums={}
    for day in allowed_days:
        vals=[x for x in hourly.values() if x["day"]==day]
        sums[day]={k:round(sum(r[k] for r in vals),2) for k in fields}
        sums[day]["hour_coverage"]=len(vals)
        sums[day]["statuses"]={k:round(sum(v["statuses"].get(k,0) for v in vals),2)
                              for k in ("success","clientDisconnected","scriptThrewException","exceededResources","internalError","other")}
    return {"status":"COMPARABLE_WINDOW" if all(sums[d]["hour_coverage"]>=last_hour-2 for d in allowed_days) else "PARTIAL_HOURS",
            "scope":"CF_DO_ACCOUNT_WIDE__WORKER_SCRIPT_FILTERED__NO_DO_NAMESPACE_ATTRIBUTION",
            "deploy_time_vn":DEPLOY_VN.isoformat(),
            "sampled_graphql_not_invoice":True,"hours_compared":"01:00-"+str(last_hour).zfill(2)+":59 VN",
            "datasets":sizes,"days":sums}

def main():
    if os.environ.get("E085_SELFTEST")=="1":
        row={"dimensions":{"datetimeHour":"2026-10-26T18:00:00Z"}}
        assert hourkey(row)==("2026-10-27",1)
        assert n("oops")==0 and n(5)==5
        print("E085_SELFTEST_PASS")
        return
    status,source=query()
    evidence=aggregate(source,dt.datetime.now(TZ)) if status=="OK" else {"status":status}
    OUT.write_text(json.dumps(evidence,ensure_ascii=True,indent=2)+"\n",encoding="utf-8")
    print("E085_READONLY="+evidence["status"])
    print("E085_SCOPE="+evidence.get("scope","UNVERIFIED"))
    print("E085_DATASETS="+json.dumps(evidence.get("datasets",{})))
    print("E085_NO_WORKER_OR_PROVIDER_MUTATION")
if __name__=="__main__": main()

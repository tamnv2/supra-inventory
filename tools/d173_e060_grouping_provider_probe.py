#!/usr/bin/env python3
"""E060 READ-ONLY GraphQL grouping field smoke using existing beta tokens."""
import datetime as dt
import json, os, urllib.request, urllib.error
acct=os.getenv("CF_ACCOUNT_ID","")
zone=os.getenv("CF_ZONE_ID","")
worker_token=os.getenv("D166_CF_READ_TOKEN","")
email_token=os.getenv("D173_CF_EMAIL_ANALYTICS_READ","")
now=dt.datetime.now(dt.timezone.utc)
yesterday=(now-dt.timedelta(days=1)).strftime("%Y-%m-%d")
hour=(now-dt.timedelta(hours=1)).strftime("%Y-%m-%dT%H:00:00Z")
minute=(now-dt.timedelta(hours=1)).strftime("%Y-%m-%dT%H:00:00Z")
checks=[
 ("DO_24H",worker_token,'{viewer{accounts(filter:{accountTag:"'+acct+'"}){x:durableObjectsPeriodicGroups(filter:{date_geq:"'+yesterday+'"},limit:1){dimensions{datetimeFiveMinutes} sum{rowsRead}}}}}'),
 ("DO_7D",worker_token,'{viewer{accounts(filter:{accountTag:"'+acct+'"}){x:durableObjectsPeriodicGroups(filter:{date_geq:"'+yesterday+'"},limit:1){dimensions{datetimeHour} sum{rowsRead}}}}}'),
 ("DO_30D",worker_token,'{viewer{accounts(filter:{accountTag:"'+acct+'"}){x:durableObjectsPeriodicGroups(filter:{date_geq:"'+yesterday+'"},limit:1){dimensions{date} sum{rowsRead}}}}}'),
 ("EMAIL_24H",email_token,'{viewer{zones(filter:{zoneTag:"'+zone+'"}){x:emailSendingAdaptiveGroups(filter:{datetimeFiveMinutes_geq:"'+minute+'"},limit:1){dimensions{datetimeFiveMinutes} count}}}}'),
 ("EMAIL_7D",email_token,'{viewer{zones(filter:{zoneTag:"'+zone+'"}){x:emailSendingAdaptiveGroups(filter:{date_geq:"'+yesterday+'"},limit:1){dimensions{datetimeHour} count}}}}'),
 ("EMAIL_30D",email_token,'{viewer{zones(filter:{zoneTag:"'+zone+'"}){x:emailSendingAdaptiveGroups(filter:{date_geq:"'+yesterday+'"},limit:1){dimensions{date} count}}}}'),
]
# Validate the remaining displayed Cloudflare chart families, not just DO SQL + Email.
for gran in ("datetimeFiveMinutes","datetimeHour","date"):
 checks.append(("DO_REQUESTS_"+gran,worker_token,
   '{viewer{accounts(filter:{accountTag:"'+acct+'"}){x:durableObjectsInvocationsAdaptiveGroups(filter:{date_geq:"'+yesterday+'"},limit:1){dimensions{'+gran+'} sum{requests}}}}}'))
 checks.append(("D1_READ_"+gran,worker_token,
   '{viewer{accounts(filter:{accountTag:"'+acct+'"}){x:d1AnalyticsAdaptiveGroups(filter:{date_geq:"'+yesterday+'"},limit:1){dimensions{'+gran+'} sum{rowsRead}}}}}'))
 checks.append(("WORKER_REQ_"+gran,worker_token,
   '{viewer{accounts(filter:{accountTag:"'+acct+'"}){x:workersInvocationsAdaptive(filter:{scriptName:"supra-inventory-beta",datetime_geq:"'+hour+'"},limit:1){dimensions{'+gran+'} sum{requests}}}}}'))
ok=0
for name,token,q in checks:
 if not token:
  print("D173_E060_QUERY_"+name+"=NO_TOKEN")
  continue
 request=urllib.request.Request("https://api.cloudflare.com/client/v4/graphql",
    method="POST",data=json.dumps({"query":q}).encode(),
    headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"})
 try:
  with urllib.request.urlopen(request,timeout=15) as resp:
   result=json.load(resp)
  passed=not result.get("errors") and bool((result.get("data") or {}).get("viewer"))
  print("D173_E060_QUERY_"+name+"="+("PASS" if passed else "SCHEMA_OR_SCOPE"))
  ok+=int(passed)
 except urllib.error.HTTPError as err:
  print("D173_E060_QUERY_"+name+"=HTTP_"+str(err.code))
 except Exception:
  print("D173_E060_QUERY_"+name+"=NETWORK_UNAVAILABLE")
print("D173_E060_GROUPED_QUERIES_PASS="+str(ok)+"/"+str(len(checks)))
if ok < len(checks):raise SystemExit(2)

#!/usr/bin/env python3
"""D169 exact-session, bounded, idempotent Firestore cleanup. Beta only."""
import argparse, json, os, re, sys
import google.auth
from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account

PROJECT="supra-inventory-beta"
BASE=f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
PREFIX=f"projects/{PROJECT}/databases/(default)/documents/d169_diag_sessions/"
COLLECTIONS=("receipts","messages","members")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--session",required=True)
    args=p.parse_args()
    if not re.fullmatch("[a-f0-9]{32}",args.session):
        raise RuntimeError("INVALID_SESSION_ID")
    if os.getenv("D169_CLEANUP_CONFIRM")!="D169_LOGS_ARCHIVED_AND_OWNER_APPROVED_DELETE":
        raise RuntimeError("OWNER_EVIDENCE_GATE_MISSING")
    creds_file=os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
    creds=service_account.Credentials.from_service_account_file(
        creds_file,scopes=["https://www.googleapis.com/auth/datastore"])
    if creds.project_id!=PROJECT:
        raise RuntimeError("WRONG_GOOGLE_PROJECT")
    client=AuthorizedSession(creds)
    root=f"{BASE}/d169_diag_sessions/{args.session}"
    deleted={}
    for col in COLLECTIONS:
        count=0
        while True:
            r=client.get(f"{root}/{col}",params={"pageSize":100},timeout=20)
            if r.status_code==404:break
            r.raise_for_status()
            docs=r.json().get("documents",[])
            if not docs:break
            for d in docs:
                name=d.get("name","")
                if not re.fullmatch(re.escape(PREFIX)+args.session+"/"+col+r"/[^/]+",name):
                    raise RuntimeError("OUTSIDE_CANARY_SCOPE_REFUSED")
                x=client.delete("https://firestore.googleapis.com/v1/"+name,timeout=20)
                if x.status_code not in (200,204,404):x.raise_for_status()
                count+=1
            if len(docs)<100:break
        deleted[col]=count
    q=client.delete(root,timeout=20)
    if q.status_code not in (200,204,404):q.raise_for_status()
    verify=client.get(root,timeout=20)
    if verify.status_code!=404:raise RuntimeError("CANARY_ROOT_NOT_REMOVED")
    print("D169_SESSION_DELETE_PASS",json.dumps({"root":"D169_CANARY_REMOVED","children_deleted":deleted}))
    print("NEXT_REVIEWED_PR_REQUIRED: remove d169_diag_sessions Rules and mark registry RETIRED after all sessions closed")
if __name__=="__main__":
    main()

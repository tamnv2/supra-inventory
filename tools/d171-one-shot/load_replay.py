#!/usr/bin/env python3
"""D171 maximum-load logic replay, offline only; not real Firebase billing/latency."""
import json

PDA_COUNT=40
AGENT_COUNT=6
PICKLIST_TOTAL=2000
KICK_TOTAL=200
CALL_TOTAL=300
CHAT_TOTAL=500

def replay():
    results=[]
    for mode,initial_primary in (("VPS_HEALTHY","tamnv2"),("VPS_FAILED_NORMAL_AGENT","admin"),("VPS_FAILED_OFFICE_AGENT","admin")):
        created=set()
        confirmations=set()
        uncertain=set()
        duplicates_rejected=0
        acked=set()
        # Every PDA carries the same immutable job identity even during handoff.
        primary=initial_primary
        generation=1 if initial_primary=="tamnv2" else 2
        peak_ids=[]
        for n in range(PICKLIST_TOTAL):
            pda=n%PDA_COUNT
            request_id=f"diag-j{n:04d}-p{pda:02d}"
            if n<20: peak_ids.append((request_id,n%5))
            if n==PICKLIST_TOTAL//2 and mode=="VPS_HEALTHY":
                # Crash/return transition has a fencing generation, not a re-created request.
                primary="admin";generation+=1
            if request_id in created: raise AssertionError("duplicate initial job")
            created.add(request_id)
            # Deliberate network duplicate replay with the exact same ID.
            if n%7==0:
                if request_id in created:duplicates_rejected+=1
                else:raise AssertionError("replayed job accepted")
            if n in (499,1500):
                uncertain.add(request_id)
                continue  # Simulate click result UNKNOWN; never fake a success ACK.
            confirmations.add((request_id,primary,generation))
            acked.add(request_id)
        ids={x[0] for x in confirmations}
        assert len(created)==PICKLIST_TOTAL and len(ids)==PICKLIST_TOTAL-len(uncertain)
        assert not ids.intersection(uncertain) and acked==ids
        assert len(peak_ids)==20 and len({x[0] for x in peak_ids})==20
        assert max(t for _,t in peak_ids)<5
        controls={"kick":KICK_TOTAL,"call":CALL_TOTAL,"chat":CHAT_TOTAL}
        assert sum(controls.values())==1000
        results.append({"mode":mode,"synthetic_only":True,"simulated_agents":AGENT_COUNT,
            "simulated_pda":PDA_COUNT,"immutable_jobs":len(created),
            "terminal_acks":len(acked),"uncertain_not_replayed":len(uncertain),
            "duplicate_submissions_rejected":duplicates_rejected,
            "peak": "20 distinct PDA submissions in 5 synthetic seconds",
            "operator_events":controls,"firestore_requests":0,
            "real_wms_mutations":0,"cost_estimate_verified":False,
            "physical_latency_p95_ms":None})
    return {"status":"OFFLINE_LOGIC_REPLAY_PASS","scenarios":results,
        "important_limitation":"No Firebase bill, Office routing proof or physical latency inferred."}

if __name__=="__main__":
    print(json.dumps(replay(),ensure_ascii=False,indent=2))

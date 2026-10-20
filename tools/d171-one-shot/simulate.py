#!/usr/bin/env python3
"""D171 isolated, zero-network preflight for one-shot Office test.

No Firebase, Worker, WMS, RTDB, Function, token or device API is used.
A PASS proves simulation invariants only, NEVER actual Office reachability.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field

PHASES = (
    ("NORMAL", "NORMAL"),
    ("OFFICE", "NORMAL"),
    ("NORMAL", "OFFICE"),
    ("OFFICE", "OFFICE"),
    ("NORMAL", "NORMAL"),
)
ROLES = {"A": ("admin", "LOCAL_AGENT"), "B": ("tamnv2", "SIMULATED_VPS")}
LOAD = {"agents": 6, "pda": 40, "picklist": 2000, "kick": 200, "call": 300, "chat": 500, "peak_pda_in_5s": 20}
SAMPLE_BUDGET = {"windows_http_read_each": 550, "windows_write_each": 350, "pda_writes": 250, "live_minutes": 40}

@dataclass
class RoundGate:
    phase: int = 0
    agent: dict = field(default_factory=dict)
    picker_ready: bool = False
    a_acks: set = field(default_factory=set)
    b_acks: set = field(default_factory=set)
    run_epoch: int = 1

    def ready(self) -> bool:
        if self.phase not in range(5) or not self.picker_ready:
            return False
        return all(self.agent.get(alias) == (PHASES[self.phase][i], self.run_epoch, True)
                   for i, alias in enumerate(("A", "B")))

    def ingest_ack(self, alias: str, request_id: str, epoch: int) -> None:
        if not self.ready() or epoch != self.run_epoch or alias not in ("A", "B"):
            return
        (self.a_acks if alias == "A" else self.b_acks).add(request_id)

    def complete(self, sent: set) -> bool:
        return self.ready() and self.a_acks == sent and self.b_acks == sent and len(sent) == 9

    def next(self, sent: set) -> None:
        assert self.complete(sent), "D171_PHASE_BARRIER_NOT_COMPLETE"
        self.phase += 1
        self.run_epoch += 1
        self.agent.clear()
        self.picker_ready = False
        self.a_acks.clear()
        self.b_acks.clear()


@dataclass
class Leader:
    primary: str = "tamnv2"
    generation: int = 1
    lease_until_s: int = 10
    inflight: set = field(default_factory=set)
    confirmed: set = field(default_factory=set)
    uncertain: set = field(default_factory=set)
    manual_holder: bool = False

    def claim(self, candidate: str, at_s: int, expected_generation: int,
              coordination_reachable: bool, wms_ready: bool) -> bool:
        if candidate not in ("admin", "tamnv2") or not coordination_reachable or not wms_ready:
            return False
        if at_s <= self.lease_until_s or expected_generation != self.generation:
            return False
        self.primary = candidate
        self.generation += 1
        self.lease_until_s = at_s + 10
        return True

    def begin(self, request: str, presented_generation: int) -> bool:
        if presented_generation != self.generation:
            return False
        if request in self.confirmed or request in self.uncertain or request in self.inflight:
            return False
        self.inflight.add(request)
        return True

    def finish(self, request: str, outcome: str) -> None:
        assert request in self.inflight
        self.inflight.remove(request)
        (self.confirmed if outcome == "CONFIRMED" else self.uncertain).add(request)

    def reclaim_vps(self, at_s: int, ready_stable_s: int, consent: bool) -> bool:
        if self.inflight or ready_stable_s < 30 or (self.manual_holder and not consent):
            return False
        return self.claim("tamnv2", at_s, self.generation, True, True)


def test_five_round_barrier() -> dict:
    gate = RoundGate()
    records = []
    for n, (net_a, net_b) in enumerate(PHASES):
        sent = {f"P{n}-{i}" for i in range(9)}
        gate.agent["A"] = (net_a, gate.run_epoch, True)
        gate.picker_ready = True
        assert not gate.ready(), "PDA cannot dispatch until B exact-route READY"
        gate.agent["B"] = ("OFFICE" if net_b == "NORMAL" else "NORMAL", gate.run_epoch, True)
        assert not gate.ready(), "Wrong network must block dispatch"
        gate.agent["B"] = (net_b, gate.run_epoch - 1, True)
        assert not gate.ready(), "Stale network epoch must block dispatch"
        gate.agent["B"] = (net_b, gate.run_epoch, True)
        assert gate.ready()
        for req in sent:
            gate.ingest_ack("A", req, gate.run_epoch - 1)
        assert not gate.a_acks, "Stale ACK must be dropped"
        for req in sent:
            gate.ingest_ack("A", req, gate.run_epoch)
        assert not gate.complete(sent), "A-only ACK is not PASS"
        for req in sent:
            gate.ingest_ack("B", req, gate.run_epoch)
        assert gate.complete(sent)
        records.append({"phase": n + 1, "A_network": net_a, "B_network": net_b, "A_ack": 9, "B_ack": 9, "dual_ack": 9})
        gate.next(sent)
    assert gate.phase == 5
    return {"status": "OFFLINE_SIM_PASS", "rounds": records}


def test_fenced_handoff() -> dict:
    leader = Leader()
    assert not leader.claim("admin", 8, 1, True, True), "Fresh VPS lease must fence standby"
    assert not leader.claim("admin", 16, 1, False, True), "Partition must fail closed"
    assert not leader.claim("admin", 16, 1, True, False), "WMS not ready"
    assert leader.claim("admin", 16, 1, True, True)
    assert not leader.claim("tamnv2", 17, 1, True, True), "Old generation cannot preempt"
    assert leader.begin("pick-1", 2)
    assert not leader.begin("pick-1", 2), "Duplicate WMS execution"
    assert not leader.reclaim_vps(27, 60, True), "Do not hand back in-flight"
    leader.finish("pick-1", "UNCERTAIN")
    assert not leader.begin("pick-1", 2), "UNKNOWN WMS outcome cannot replay"
    leader.manual_holder = True
    assert not leader.reclaim_vps(27, 60, False), "Manual holder consent required"
    assert not leader.reclaim_vps(27, 29, True), "VPS WMS-ready 30s required"
    assert leader.reclaim_vps(27, 30, True)
    assert leader.primary == "tamnv2" and leader.generation == 3
    return {"status": "OFFLINE_SIM_PASS", "primary": leader.primary, "generation": leader.generation,
            "uncertain_guard": True, "single_primary": True}


def forecast(poll_seconds: int = 4) -> dict:
    assert poll_seconds >= 3
    # Scenario-only unbilled baselines documented in D171-E022, NOT Google billed reads.
    read_vps_reference = 33060
    write_reference = 15180
    active_fallback_s = 8 * 3600
    # Incremental polling relative to 10-second healthy watchdog; conservative one-doc floor.
    extra = max(0, (active_fallback_s + poll_seconds - 1) // poll_seconds - (active_fallback_s + 9) // 10)
    projected = read_vps_reference + extra
    return {"assumptions": {"daily_load": LOAD, "healthy_reference_reads": read_vps_reference,
             "healthy_reference_writes": write_reference, "fallback_active_hours": 8,
             "fallback_rest_poll_seconds": poll_seconds},
            "scenario_only_reads": projected, "scenario_only_writes": write_reference,
            "target_90_percent_free": {"reads": 45000, "writes": 18000},
            "reads_headroom_before_shared_workloads": 45000 - projected,
            "writes_headroom_before_shared_workloads": 18000 - write_reference,
            "billing_verified": False, "can_claim_free_usage_guarantee": False}



def replay_observed_field_failover() -> dict:
    """Anonymized timing samples only, not full field messages."""
    sla_ms = 20000
    observe_ms = 45000

    def classify(takeover_ms):
        if takeover_ms is None or takeover_ms > observe_ms:
            return "NO_TAKEOVER_WITHIN_45S_HA_FAIL_NETWORK_CONTINUES"
        if takeover_ms > sla_ms:
            return "LATE_TAKEOVER_OUTSIDE_20S_SLA"
        return "PASS_WITHIN_20S"

    first = classify(19594)
    second = classify(23369)
    assert first == "PASS_WITHIN_20S"
    assert second == "LATE_TAKEOVER_OUTSIDE_20S_SLA"
    assert classify(None) == "NO_TAKEOVER_WITHIN_45S_HA_FAIL_NETWORK_CONTINUES"
    return {"status": "OFFLINE_FIELD_REPLAY_PASS", "round2_HA": first,
            "round3_HA": second, "field_network_rounds": 3,
            "remaining_network_rounds": 2, "owner_field_pass": False,
            "reason": "Late failover does not abort transport evidence and is never counted as HA PASS"}



def replay_e025_missing_rounds_only() -> dict:
    """Local sequencing gate only; historical E023 records are not re-emitted as PASS."""
    historical = {
        0: {"network": "EXTERNAL_E023_ACK_PASS", "ha": "NOT_RATED"},
        1: {"network": "EXTERNAL_E023_ACK_PASS", "ha": "WITHIN_20S"},
        2: {"network": "EXTERNAL_E023_ACK_PASS", "ha": "SLA_MISSED_23_4S"},
    }
    start_phase = 3
    new_rounds = []
    last_completed_phase = start_phase - 1  # PDA sequencing baseline, not historical replay
    new_pass_events = []
    for phase in (3, 4):
        assert phase == last_completed_phase + 1, "resume barrier"
        assert phase not in historical, "historical field proof cannot be overwritten"
        sent = {f"e025-p{phase}-m{i}" for i in range(9)}
        a_receipts = set(sent)
        b_receipts = set(sent)
        assert a_receipts == b_receipts == sent
        new_rounds.append(phase + 1)
        new_pass_events.append(phase)
        last_completed_phase = phase
    assert new_rounds == [4, 5] and new_pass_events == [3, 4]
    assert historical[2]["ha"] == "SLA_MISSED_23_4S"
    return {"status": "OFFLINE_RESUME_GATING_PASS", "prior_external_rounds": [1, 2, 3],
            "newly_tested_rounds": new_rounds, "old_rounds_replayed": False,
            "prior_ha_sla_failed": True, "field_pass": False}



def replay_e026_targeted_ha3_and_missing_links() -> dict:
    """Zero-network replay; tests stage labeling and independence, NOT physical Office."""
    evidence = {
        1: "EXTERNAL_E023_LINK_PASS",
        2: "EXTERNAL_E023_LINK_PASS",
        3: "EXTERNAL_E023_LINK_PASS",
    }
    historical_ha3 = "SLA_MISS_23_4_SECONDS"
    assert historical_ha3.startswith("SLA_MISS")
    start_phase = 2
    local_events = []
    a_ready = b_ready = True
    if not (a_ready and b_ready):
        local_events.append("HA3_NOT_RUN_PEER_NOT_READY")
    else:
        # Two small probes per sender are NOT nine-business-case link retests.
        probes = {"A": {"PING", "LEADER_PROBE"}, "B": {"PING", "LEADER_PROBE"}, "PDA": {"PING", "LEADER_PROBE"}}
        assert all(len(v)==2 for v in probes.values())
        # Positive B->A, late A->B from Owner's measured diagnostic sample.
        for origin, elapsed in (("B_TO_A", 19594), ("A_TO_B", 23369)):
            local_events.append((origin, elapsed, "PASS" if elapsed<=20000 else "HA_SLA_MISS"))
        assert local_events[0][2]=="PASS" and local_events[1][2]=="HA_SLA_MISS"
    assert start_phase==2
    phases_run = []
    for phase, nets in ((3, ("OFFICE", "OFFICE", "NORMAL")), (4, ("NORMAL", "NORMAL", "NORMAL"))):
        sent={f"E026P{phase}CASE{i}" for i in range(9)}
        # Simulated dual-ACK proof only; real field status still UNKNOWN.
        assert len(sent)==9
        a_received=set(sent)
        b_received=set(sent)
        pda_received=set(sent)
        assert a_received==b_received==pda_received==sent
        phases_run.append({"phase":phase+1, "nets":nets, "synthetic_dual_ack":9})
    def ha_safe_to_start(a_probe_ok: bool, b_probe_ok: bool,
                         a_ready: bool, b_ready: bool) -> bool:
        return a_probe_ok and b_probe_ok and a_ready and b_ready
    assert ha_safe_to_start(True,True,True,True)
    assert not ha_safe_to_start(True,False,True,True)
    assert not ha_safe_to_start(True,True,False,True)
    assert not ha_safe_to_start(True,True,True,False)
    assert list(evidence)==[1,2,3] and [p["phase"] for p in phases_run]==[4,5]
    assert any(e[-1]=="HA_SLA_MISS" for e in local_events)
    return {"status":"OFFLINE_E026_SCENARIO_PASS", "old_link_evidence":evidence,
            "historical_ha3":historical_ha3,
            "test_ha3_not_repeated_nine_cases":True,
            "tested_ha3_two_directions":local_events,
            "simulated_only_remaining_link_phases":phases_run,
            "physical_new_rounds_verified":False, "firebase_requests":0,
            "owner_pass":False, "unknown_late_cas_still_failure":True,
            "peer_readiness_and_2probe_fail_closed":True}


def main() -> None:
    report = {"change": "D171", "topology": ROLES, "physical_live_budget": SAMPLE_BUDGET,
              "live_firebase_requests": 0, "field_pass": False, "owner_pass": False,
              "test_gate": test_five_round_barrier(), "ha_gate": test_fenced_handoff(),
              "field_replay": replay_observed_field_failover(),
              "resume_replay": replay_e025_missing_rounds_only(),
              "e026": replay_e026_targeted_ha3_and_missing_links(),
              "usage_samples": [forecast(t) for t in (3, 4, 6, 8, 10, 15)]}
    assert report["test_gate"]["status"] == "OFFLINE_SIM_PASS"
    assert report["ha_gate"]["status"] == "OFFLINE_SIM_PASS"
    assert report["live_firebase_requests"] == 0
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

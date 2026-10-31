#!/usr/bin/env python3
"""D173-E108 offline contract tests; synthetic data only; no cloud traffic."""
import os
import sqlite3
import tempfile
import unittest

from d173_e108_m2_poc import (
    ContractError, Principal, SyntheticCore, Transport, billed_request_planning,
)


def command(rid, operation, **args):
    return {"request_id": rid, "operation": operation, "args": args}


def provision(core):
    for uid, role in (("p1", "PICKER"), ("p2", "PICKER"),
                      ("p3", "PICKER"), ("r1", "REPORTER"), ("root", "ROOT")):
        core.add_user(uid, role)
    return {x: Principal(x, 1) for x in ("p1", "p2", "p3", "r1", "root")}


def failure(code, fn):
    with unittest.TestCase().assertRaises(ContractError) as ctx:
        fn()
    if ctx.exception.code != code:
        raise AssertionError(f"expected {code}, got {ctx.exception.code}")


class M2ContractTests(unittest.TestCase):
    def setUp(self):
        self.core = SyntheticCore()
        self.p = provision(self.core)

    def test_report_group_priority_version_and_cas(self):
        c, p = self.core, self.p
        first = c.dispatch(p["p1"], command("1", "REPORT", sku="SKU-A", now=100))
        second = c.dispatch(p["p2"], command("2", "REPORT", sku="SKU-A", now=101))
        self.assertEqual(first["batch_id"], second["batch_id"])
        self.assertEqual((first["version"], second["version"]), (1, 2))
        failure("ACTIVE_REPORT_EXISTS", lambda: c.dispatch(
            p["p1"], command("3", "REPORT", sku="SKU-A", now=102)))
        failure("VERSION_CONFLICT", lambda: c.dispatch(p["r1"], command(
            "4", "RESOLVE", batch_id=1, expected_version=1,
            resolution="HAS_STOCK", now=103)))
        result = c.dispatch(p["r1"], command(
            "5", "RESOLVE", batch_id=1, expected_version=2,
            resolution="SKIP_ALLOWED", now=104))
        self.assertEqual(result["status"], "SKIP_ALLOWED")
        self.assertEqual(c.snapshot(), [(1, "SKU-A", "SKIP_ALLOWED", 3)])

    def test_withdraw_60_seconds_server_window(self):
        c, p = self.core, self.p
        c.dispatch(p["p1"], command("1", "REPORT", sku="A", now=100))
        result = c.dispatch(p["p1"], command("2", "WITHDRAW", batch_id=1, now=160))
        self.assertEqual(result["status"], "WITHDRAWN")
        c.dispatch(p["p2"], command("3", "REPORT", sku="B", now=100))
        failure("WITHDRAW_WINDOW_CLOSED", lambda: c.dispatch(
            p["p2"], command("4", "WITHDRAW", batch_id=2, now=161)))

    def test_correction_five_minutes_and_ack_target(self):
        c, p = self.core, self.p
        c.dispatch(p["p1"], command("1", "REPORT", sku="A", now=100))
        c.dispatch(p["p2"], command("2", "REPORT", sku="A", now=100))
        result = c.dispatch(p["r1"], command(
            "3", "RESOLVE", batch_id=1, expected_version=2,
            resolution="SKIP_ALLOWED", now=200))
        correction = c.dispatch(p["r1"], command(
            "4", "CORRECT", batch_id=1, expected_version=3,
            resolution="HAS_STOCK", now=500))
        self.assertEqual(correction["version"], 4)
        a = c.dispatch(p["p1"], command(
            "5", "ACK", batch_id=1, event_id=correction["event_id"]))
        self.assertTrue(a["acknowledged"])
        failure("ACK_NOT_ALLOWED", lambda: c.dispatch(
            p["p3"], command("6", "ACK", batch_id=1, event_id=correction["event_id"])))
        failure("ACK_NOT_ALLOWED", lambda: c.dispatch(
            p["p2"], command("7", "ACK", batch_id=1, event_id=result["event_id"])))
        failure("CORRECTION_WINDOW_CLOSED", lambda: c.dispatch(
            p["r1"], command("8", "CORRECT", batch_id=1,
                             expected_version=4, resolution="HAS_STOCK", now=502)))

    def test_idempotency_and_reused_request_id(self):
        c, p = self.core, self.p
        frame = command("same", "REPORT", sku="A", now=100)
        one = c.dispatch(p["p1"], frame)
        again = c.dispatch(p["p1"], frame)
        self.assertEqual(one, again)
        self.assertEqual(c.db.execute("SELECT count(*) FROM tickets").fetchone()[0], 1)
        failure("REQUEST_ID_REUSED", lambda: c.dispatch(
            p["p1"], command("same", "REPORT", sku="B", now=100)))

    def test_loss_of_ws_ack_falls_back_to_http_same_id(self):
        c, p = self.core, self.p
        ws, http = Transport(c, "WS"), Transport(c, "HTTP")
        frame = command("lost-result", "REPORT", sku="A", now=100)
        committed = ws.command(p["p1"], frame)  # app loses this response
        restored = http.command(p["p1"], frame)
        self.assertEqual(committed, restored)
        self.assertEqual(c.db.execute("SELECT count(*) FROM events").fetchone()[0], 1)

    def test_reconnect_and_durable_receipt_after_process_restart(self):
        with tempfile.TemporaryDirectory() as temp:
            name = os.path.join(temp, "isolated.sqlite")
            db = sqlite3.connect(name, isolation_level=None)
            before = SyntheticCore(db)
            principals = provision(before)
            frame = command("persist", "REPORT", sku="A", now=100)
            original = before.dispatch(principals["p1"], frame)
            db.close()
            reopened = SyntheticCore(sqlite3.connect(name, isolation_level=None))
            restored = reopened.dispatch(principals["p1"], frame)
            self.assertEqual(original, restored)
            reopened.db.close()

    def test_session_revocation_and_live_role(self):
        c, p = self.core, self.p
        c.set_user("p1", generation=2)
        failure("SESSION_REVOKED", lambda: c.dispatch(
            p["p1"], command("1", "REPORT", sku="A", now=100)))
        c.set_user("p1", generation=1, role="REPORTER")
        failure("FORBIDDEN", lambda: c.dispatch(
            p["p1"], command("2", "REPORT", sku="A", now=100)))
        c.set_user("p1", status="DISABLED")
        failure("SESSION_REVOKED", lambda: c.recover(p["p1"], 0, c.epoch))

    def test_audience_gap_not_lost_frame(self):
        c, p = self.core, self.p
        c.dispatch(p["p1"], command("1", "REPORT", sku="A", now=100))
        c.dispatch(p["p2"], command("2", "REPORT", sku="B", now=100))
        delta = c.recover(p["p1"], 1, c.epoch)
        self.assertEqual(delta["events"], [])
        self.assertEqual(delta["covered_through"], 2)
        self.assertFalse(delta["resync_required"])
        self.assertFalse(delta["has_more"])

    def test_missing_authorized_frame_and_paging(self):
        c, p = self.core, self.p
        for i in range(205):
            c.dispatch(p["p1"], command(str(i), "REPORT", sku=f"S{i}", now=100))
        first = c.recover(p["p1"], 0, c.epoch, limit=100)
        self.assertEqual(len(first["events"]), 100)
        self.assertTrue(first["has_more"])
        second = c.recover(p["p1"], first["covered_through"], c.epoch, limit=200)
        self.assertEqual(len(second["events"]), 105)
        self.assertEqual(second["covered_through"], 205)
        self.assertFalse(second["has_more"])

    def test_epoch_retention_cursor_invalid(self):
        c, p = self.core, self.p
        for i in range(3):
            c.dispatch(p["p1"], command(str(i), "REPORT", sku=f"S{i}", now=100))
        self.assertTrue(c.recover(p["p1"], 0, "old-epoch")["resync_required"])
        self.assertTrue(c.recover(p["p1"], 99, c.epoch)["resync_required"])
        c.db.execute("DELETE FROM audience WHERE seq=1")
        c.db.execute("DELETE FROM events WHERE seq=1")
        self.assertTrue(c.recover(p["p1"], 0, c.epoch)["resync_required"])

    def test_canonical_parity_synthetic_http_ws(self):
        def run(mode):
            c = SyntheticCore()
            p = provision(c)
            t = Transport(c, mode)
            traces = [
                ("p1", command("1", "REPORT", sku="A", now=100)),
                ("p2", command("2", "REPORT", sku="A", now=101)),
                ("p3", command("3", "REPORT", sku="B", now=102)),
                ("r1", command("4", "RESOLVE", batch_id=1, expected_version=2,
                               resolution="SKIP_ALLOWED", now=103)),
                ("r1", command("5", "CORRECT", batch_id=1, expected_version=3,
                               resolution="HAS_STOCK", now=105)),
                ("p1", command("6", "ACK", batch_id=1, event_id=5)),
                ("p3", command("7", "WITHDRAW", batch_id=2, now=106)),
            ]
            results = [t.command(p[uid], msg) for uid, msg in traces]
            return results, c.snapshot(), [tuple(x) for x in c.db.execute(
                "SELECT seq,kind,payload FROM events ORDER BY seq")], c.meters

        a, b, e, usage_http = run("HTTP")
        x, y, z, usage_ws = run("WS")
        self.assertEqual((a, b, e), (x, y, z))
        self.assertEqual(usage_http["http"], 28)
        self.assertEqual(usage_ws["ws_in"], 7)
        self.assertEqual(usage_ws["ws_handshake"], 1)
        self.assertEqual(usage_ws["http"], 0)

    def test_planning_budget_and_burst(self):
        self.assertEqual(billed_request_planning(8000, 10000, 0), 263500)
        self.assertEqual(billed_request_planning(8000, 100000, 0), 403000)
        self.assertEqual(billed_request_planning(8000, 10000, 1), 263531)
        failure("INVALID_LIMIT", lambda: self.core.recover(
            self.p["p1"], 0, self.core.epoch, 201))
        for i in range(20):
            self.core.add_user("burst" + str(i), "PICKER")
        for i in range(20):
            self.core.dispatch(Principal("burst" + str(i), 1),
                               command("burst" + str(i), "REPORT", sku="BURST", now=100))
        self.assertEqual(self.core.snapshot(), [(1, "BURST", "OPEN", 20)])


if __name__ == "__main__":
    unittest.main(verbosity=2)

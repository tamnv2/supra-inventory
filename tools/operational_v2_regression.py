#!/usr/bin/env python3
"""Regression fixtures for Operational V2 result/event/privacy/count invariants."""

from __future__ import annotations

import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def fail(message: str) -> None:
    raise SystemExit(f"OPERATIONAL_V2_REGRESSION_FAIL: {message}")


def require_source_markers() -> None:
    operational = (ROOT / "service/src/operational-v2-core.ts").read_text(encoding="utf-8")
    read_model = (ROOT / "service/src/read-model-core.ts").read_text(encoding="utf-8")
    notifications = (ROOT / "service/src/notifications-core.ts").read_text(encoding="utf-8")
    business = (ROOT / "service/src/business-core.ts").read_text(encoding="utf-8")

    markers = {
        "immutable result snapshot table": "CREATE TABLE IF NOT EXISTS result_event_snapshots",
        "pending result reads snapshot": "JOIN result_event_snapshots s ON s.result_event_id = a.result_event_id",
        "event snapshot written at mutation": "INSERT OR IGNORE INTO result_event_snapshots",
        "picker delta ticket ownership": "WHERE t.ticket_id = e.ticket_id AND t.picker_user_id = ?",
        "picker delta result targeting": "WHERE a.result_event_id = e.event_id AND a.target_user_id = ?",
        "event version stays historical": "batch_version: Number(row.batch_version || 0)",
    }
    haystacks = {
        "immutable result snapshot table": operational,
        "pending result reads snapshot": operational,
        "event snapshot written at mutation": business,
        "picker delta ticket ownership": operational,
        "picker delta result targeting": operational,
        "event version stays historical": operational,
    }
    for name, marker in markers.items():
        if marker not in haystacks[name]:
            fail(f"source invariant missing: {name}")

    if "pickerCanReceiveRealtimeEvent" not in read_model or "pickerRealtimeSnapshot" not in read_model:
        fail("broadcast is not using Picker-authorized projection")
    if "status = 'RESOLVED'" not in notifications or "result_event_id" not in notifications:
        fail("notification target projection does not enforce result targets")


def fixture_connection() -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.executescript(
        """
        CREATE TABLE report_batches (
          batch_id TEXT PRIMARY KEY, sku TEXT, product_name TEXT, status TEXT,
          version INTEGER, resolution TEXT, resolved_at TEXT, updated_at TEXT
        );
        CREATE TABLE report_tickets (
          ticket_id TEXT PRIMARY KEY, batch_id TEXT, picker_user_id TEXT,
          picker_employee_code TEXT, status TEXT, reported_at TEXT
        );
        CREATE TABLE result_acknowledgements (
          result_event_id TEXT, batch_id TEXT, batch_version INTEGER,
          target_user_id TEXT, acknowledged_at TEXT, created_at TEXT
        );
        CREATE TABLE result_event_snapshots (
          result_event_id TEXT PRIMARY KEY, batch_id TEXT, batch_version INTEGER,
          event_type TEXT, sku TEXT, product_name TEXT, resolution TEXT,
          result_at TEXT, created_at TEXT
        );
        CREATE TABLE realtime_events (
          seq INTEGER PRIMARY KEY, event_id TEXT, event_type TEXT, batch_id TEXT,
          ticket_id TEXT, batch_version INTEGER, scopes_json TEXT, payload_json TEXT,
          created_at TEXT
        );
        CREATE TABLE report_events (
          event_id TEXT PRIMARY KEY, batch_id TEXT, ticket_id TEXT,
          event_type TEXT, actor_user_id TEXT, payload_json TEXT, created_at TEXT
        );
        """
    )
    db.execute(
        "INSERT INTO report_batches VALUES (?,?,?,?,?,?,?,?)",
        ("b1", "00123", "SP A", "HAS_STOCK", 6, "HAS_STOCK", "2026-09-18T00:06:00Z", "2026-09-18T00:06:00Z"),
    )
    db.executemany(
        "INSERT INTO report_tickets VALUES (?,?,?,?,?,?)",
        [
            ("t1", "b1", "p1", "101", "RESOLVED", "2026-09-18T00:00:00Z"),
            ("t2", "b1", "p2", "102", "RESOLVED", "2026-09-18T00:01:00Z"),
            ("t3", "b1", "p3", "103", "WITHDRAWN", "2026-09-18T00:02:00Z"),
        ],
    )
    db.executemany(
        "INSERT INTO result_event_snapshots VALUES (?,?,?,?,?,?,?,?,?)",
        [
            ("ev-skip", "b1", 5, "BATCH_RESOLVED", "00123", "SP A", "SKIP_ALLOWED", "2026-09-18T00:05:00Z", "2026-09-18T00:05:00Z"),
            ("ev-stock", "b1", 6, "BATCH_CORRECTED", "00123", "SP A", "HAS_STOCK", "2026-09-18T00:06:00Z", "2026-09-18T00:06:00Z"),
        ],
    )
    db.executemany(
        "INSERT INTO result_acknowledgements VALUES (?,?,?,?,?,?)",
        [
            ("ev-skip", "b1", 5, "p1", None, "2026-09-18T00:05:00Z"),
            ("ev-skip", "b1", 5, "p2", None, "2026-09-18T00:05:00Z"),
            ("ev-stock", "b1", 6, "p1", "2026-09-18T00:07:00Z", "2026-09-18T00:06:00Z"),
            ("ev-stock", "b1", 6, "p2", None, "2026-09-18T00:06:00Z"),
        ],
    )
    db.executemany(
        "INSERT INTO report_events VALUES (?,?,?,?,?,?,?)",
        [
            ("ev-other-ticket", "b1", "t2", "REPORT_CREATED", "p2", "{}", "2026-09-18T00:01:00Z"),
            ("ev-stock", "b1", None, "BATCH_CORRECTED", "reporter1", '{"to":"HAS_STOCK"}', "2026-09-18T00:06:00Z"),
            ("ev-own-ticket", "b1", "t1", "REPORT_CREATED", "p1", "{}", "2026-09-18T00:00:00Z"),
        ],
    )
    db.executemany(
        "INSERT INTO realtime_events VALUES (?,?,?,?,?,?,?,?,?)",
        [
            (1, "ev-other-ticket", "REPORT_CREATED", "b1", "t2", 2, '["reporter_queue","picker_reports"]', "{}", "2026-09-18T00:01:00Z"),
            (2, "ev-stock", "BATCH_CORRECTED", "b1", None, 6, '["reporter_recent","picker_reports"]', '{"to":"HAS_STOCK"}', "2026-09-18T00:06:00Z"),
            (3, "ev-own-ticket", "REPORT_CREATED", "b1", "t1", 1, '["reporter_queue","picker_reports"]', "{}", "2026-09-18T00:00:00Z"),
        ],
    )
    return db


def test_immutable_results(db: sqlite3.Connection) -> None:
    rows = db.execute(
        """
        SELECT a.result_event_id, a.batch_version, s.resolution, s.result_at,
               b.resolution AS current_resolution, b.version AS current_batch_version
          FROM result_acknowledgements a
          JOIN result_event_snapshots s ON s.result_event_id = a.result_event_id
          JOIN report_batches b ON b.batch_id = a.batch_id
         WHERE a.target_user_id = 'p1'
         ORDER BY a.created_at, a.result_event_id
        """
    ).fetchall()
    got = [(r["result_event_id"], r["batch_version"], r["resolution"]) for r in rows]
    if got != [("ev-skip", 5, "SKIP_ALLOWED"), ("ev-stock", 6, "HAS_STOCK")]:
        fail(f"immutable result snapshot mismatch: {got}")


def test_counts(db: sqlite3.Connection) -> None:
    row = db.execute(
        """
        SELECT
          (SELECT COUNT(*) FROM report_tickets t WHERE t.batch_id = b.batch_id) AS total_ticket_count,
          (SELECT COUNT(*) FROM report_tickets t WHERE t.batch_id = b.batch_id AND t.status = 'WITHDRAWN') AS withdrawn_ticket_count,
          (SELECT COUNT(DISTINCT a.target_user_id)
             FROM result_acknowledgements a
            WHERE a.batch_id = b.batch_id AND a.batch_version = b.version) AS ack_target_count,
          (SELECT COUNT(DISTINCT a.target_user_id)
             FROM result_acknowledgements a
            WHERE a.batch_id = b.batch_id AND a.batch_version = b.version
              AND a.acknowledged_at IS NOT NULL) AS acknowledged_count,
          (SELECT COUNT(DISTINCT COALESCE(t.picker_user_id, t.picker_employee_code))
             FROM report_tickets t
            WHERE t.batch_id = b.batch_id AND t.status = 'RESOLVED') AS affected_picker_count
        FROM report_batches b WHERE b.batch_id = 'b1'
        """
    ).fetchone()
    got = tuple(row[k] for k in ("total_ticket_count", "ack_target_count", "acknowledged_count", "affected_picker_count", "withdrawn_ticket_count"))
    if got != (3, 2, 1, 2, 1):
        fail(f"count integrity mismatch: {got}")


def test_picker_delta_privacy(db: sqlite3.Connection) -> None:
    rows = db.execute(
        """
        SELECT e.seq, e.event_id
          FROM realtime_events e
         WHERE e.seq > 0
           AND (
             (e.ticket_id IS NOT NULL AND EXISTS (
               SELECT 1 FROM report_tickets t
                WHERE t.ticket_id = e.ticket_id AND t.picker_user_id = ?
             ))
             OR EXISTS (
               SELECT 1 FROM result_acknowledgements a
                WHERE a.result_event_id = e.event_id AND a.target_user_id = ?
             )
             OR EXISTS (
               SELECT 1 FROM report_events r
                WHERE r.event_id = e.event_id AND r.actor_user_id = ?
             )
           )
         ORDER BY e.seq
        """,
        ("p1", "p1", "p1"),
    ).fetchall()
    got = [r["event_id"] for r in rows]
    if got != ["ev-stock", "ev-own-ticket"]:
        fail(f"Picker privacy projection mismatch: {got}")


def test_result_targets(db: sqlite3.Connection) -> None:
    targets = [r[0] for r in db.execute(
        "SELECT DISTINCT target_user_id FROM result_acknowledgements WHERE result_event_id = 'ev-stock' ORDER BY target_user_id"
    ).fetchall()]
    if targets != ["p1", "p2"] or "p3" in targets:
        fail(f"result target mismatch: {targets}")


def main() -> None:
    require_source_markers()
    db = fixture_connection()
    test_immutable_results(db)
    test_counts(db)
    test_picker_delta_privacy(db)
    test_result_targets(db)
    print("OPERATIONAL_V2_REGRESSION_PASS")


if __name__ == "__main__":
    main()

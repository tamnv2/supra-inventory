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
    sla_auto = (ROOT / "service/src/sla-automation.ts").read_text(encoding="utf-8")
    core = (ROOT / "service/src/core.ts").read_text(encoding="utf-8")
    business_api = (ROOT / "service/src/business-api.ts").read_text(encoding="utf-8")
    read_api = (ROOT / "service/src/read-api.ts").read_text(encoding="utf-8")

    markers = {
        "immutable result snapshot table": "CREATE TABLE IF NOT EXISTS result_event_snapshots",
        "pending result reads snapshot": "JOIN result_event_snapshots s ON s.result_event_id = a.result_event_id",
        "event snapshot written at mutation": "INSERT OR IGNORE INTO result_event_snapshots",
        "picker delta ticket ownership": "WHERE t.ticket_id = ? AND t.picker_user_id = ?",
        "picker delta result targeting": "WHERE a.result_event_id = ? AND a.target_user_id = ?",
        "event version stays historical": "batch_version: Number(row.batch_version || 0)",
        "D070 strict threshold ordering": "autoSkip <= escalation",
        "D070 first-report mode": 'auto_skip_mode === "FIRST_REPORT"',
        "D070 per-Picker mode": 'auto_skip_mode !== "PER_PICKER"',
        "D070 timeout source": "SYSTEM_TIMEOUT",
        "D070 durable alarm": "async alarm(): Promise<void>",
        "D070 no retroactive deadline": "only new reports get deadlines",
        "D070 overdue warning tombstone": 'recordDeadlineOnce(state, batchId, "WARNING", null, now)',
        "D070 bounded alarm catch-up": "const MAX_DUE_PER_ALARM = 50",
        "D070 alarm minimum delay": "const MIN_ALARM_DELAY_MS = 1_000",
        "D070 alarm delivery failure isolation": "Provider failure must not throw the alarm and cause platform retry storms.",
        "D141 SLA SQLite readback": "const persisted = readSlaConfig(state);",
        "D141 SLA persistence mismatch fail closed": "SLA_PERSISTENCE_VERIFY_FAILED",
        "D141 SLA readback proof": 'sqlite_readback: "PASS"',
        "D141 SLA requested mode audit": "requested_auto_skip_mode: value.auto_skip_mode",
    }
    haystacks = {
        "immutable result snapshot table": operational,
        "pending result reads snapshot": operational,
        "event snapshot written at mutation": business,
        "picker delta ticket ownership": operational,
        "picker delta result targeting": operational,
        "event version stays historical": operational,
        "D070 strict threshold ordering": sla_auto,
        "D070 first-report mode": sla_auto,
        "D070 per-Picker mode": sla_auto,
        "D070 timeout source": sla_auto,
        "D070 durable alarm": core,
        "D070 no retroactive deadline": operational,
        "D070 overdue warning tombstone": sla_auto,
        "D070 bounded alarm catch-up": sla_auto,
        "D070 alarm minimum delay": sla_auto,
        "D070 alarm delivery failure isolation": core,
        "D141 SLA SQLite readback": operational,
        "D141 SLA persistence mismatch fail closed": operational,
        "D141 SLA readback proof": operational,
        "D141 SLA requested mode audit": operational,
    }
    for name, marker in markers.items():
        if marker not in haystacks[name]:
            fail(f"source invariant missing: {name}")

    # D166 per-query SQL cursor measurements: existing statement results only,
    # bounded/aggregated in memory. No second query, network call or PII.
    metrics = (ROOT / "service/src/d166-sql-usage.ts").read_text(encoding="utf-8")
    system_metrics = (ROOT / "service/src/system-metrics-core.ts").read_text(encoding="utf-8")
    for marker in (
        '"BATCH_SNAPSHOT"',
        '"RECENT_RESULTS_COUNT"',
        '"RECENT_RESULTS_PAGE"',
        'const cursor = state.storage.sql.exec<T>(sql, ...bindings);',
        'const rows = cursor.toArray();',
        'recordD166SqlUsage(queryId, cursor, start);',
        'ISOLATE_PROCESS_LOCAL_RESTART_RESETS__ESTIMATE_NOT_BILLING',
        'const MAX_BUCKET_HOURS = 36',
    ):
        if marker not in metrics:
            fail(f"D166 SQL cursor measurement contract missing: {marker}")
    for marker in (
        'd166MeasuredSqlRows<SqlRow>(state, "BATCH_SNAPSHOT"',
        'd166MeasuredSqlRows<SqlRow>(state, "RECENT_RESULTS_COUNT"',
        'd166MeasuredSqlRows<SqlRow>(state, "RECENT_RESULTS_PAGE"',
    ):
        if marker not in operational:
            fail(f"D166 expensive Inventory SQL lacks cursor instrumentation: {marker}")
    if 'd166_sql_diagnostics: d166SqlUsageSnapshot()' not in system_metrics:
        fail("D166 SQL diagnostics missing from existing on-demand metrics endpoint")

    if "pickerCanReceiveRealtimeEvent" not in read_model or "pickerRealtimeSnapshot" not in read_model:
        fail("broadcast is not using Picker-authorized projection")
    if "status = 'RESOLVED'" not in notifications or "result_event_id" not in notifications:
        fail("notification target projection does not enforce result targets")
    for required in (
        "TICKET_AUTO_SKIP_ALLOWED",
        "BATCH_AUTO_SKIP_ALLOWED",
        "SLA_WARNING",
        "SLA_ESCALATED",
        "trg_v2_ticket_auto_skip_ack_target",
    ):
        if required not in operational:
            fail(f"D070 event/target invariant missing: {required}")
    if "auto_skip_allowed_at IS NULL" not in operational or "auto_skip_allowed_at IS NULL" not in business:
        fail("D070 active Picker projection/dedupe invariant missing")

    # D162: Operational V2 schema is initialized at DO activation. Ordinary API
    # traffic must not pay an extra /operational/init Durable Object invocation.
    if "initializeOperationalV2Schema(this.state);" not in core:
        fail("D162 InventoryCore activation schema initialization missing")
    if "ensureOperationalV2" in business_api or "ensureOperationalV2" in read_api:
        fail("D162 per-request operational readiness amplification returned")
    for marker in (
        "/authorized/operational/picker/reports",
        "/authorized/operational/picker/results",
        "/authorized/operational/picker/result-stage",
        "/authorized/operational/reporter/queue",
        "/authorized/operational/reporter/counters",
        "/authorized/operational/reporter/recent",
        "/authorized/operational/realtime/delta",
        "/authorized/realtime/ticket",
        "authorizeInteractiveIdentity",
        "x-supra-session-generation",
    ):
        if marker not in core:
            fail(f"D162 single-DO authorization marker missing: {marker}")

    # D162/D165: queue and recent workspace counters piggyback on existing business events; PER_PICKER timeout keeps the batch pending.
    for marker in (
        "queue_delta: existingBatch ? 0 : 1",
        "queue_delta: queueDelta",
        "recent_counter:",
    ):
        if marker not in business:
            fail(f"D162 reporter counter business metadata missing: {marker}")
    for marker in (
        "queue_delta: -1",
        "queue_delta: finalWaitingTicket ? -1 : 0",
        "recent_counter:",
        'after_status: "SKIP_ALLOWED"',
    ):
        if marker not in sla_auto:
            fail(f"D162 reporter counter SLA metadata missing: {marker}")

    # D165 source of truth supports BOTH resolved result directions, applies
    # the first-report Skip correction timer server-side, and uses optimistic
    # versioned writes. Android/Web must not use the retired empty POST body.
    for marker in (
        '["PENDING", "SKIP_ALLOWED", "HAS_STOCK"].includes(target)',
        'from === "HAS_STOCK" && batch.resolution === "HAS_STOCK"',
        'from === "SKIP_ALLOWED" && batch.resolution === "SKIP_ALLOWED"',
        'SKIP_CORRECTION_EXPIRED',
        'SKIP_CORRECTION_DISABLED',
        'correctionDeadlineFromFirstReport(state, batch.first_report_at)',
        'Number(batch.version || 0) !== expectedVersion',
        'recentCounter',
        '"BATCH_CORRECTED"',
        'resolution_source = \'REPORTER_CORRECTION\'',
        'target === "PENDING" ? 1 : 0',
    ):
        if marker not in business:
            fail(f"D165 cross-direction correction invariant missing: {marker}")
    android_api = (ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt").read_text(encoding="utf-8")
    android_reporter = (ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/ReporterController.kt").read_text(encoding="utf-8")
    web = (ROOT / "web/src/operational-app.ts").read_text(encoding="utf-8")
    for marker in ('"PENDING", "Đang xử lý"', '"HAS_STOCK", "Đã có hàng"', 'row.version'):
        if marker not in android_reporter:
            fail(f"D165 Android Skip correction action missing: {marker}")
    if 'fun correctBatch(batchId: String)' in android_api:
        fail("D165 old no-target/no-version Android correction helper returned")
    for marker in ('row.correction_allowed === true', 'data-correct-target="PENDING"', 'data-correct-target="${row.status === "SKIP_ALLOWED" ? "HAS_STOCK" : "SKIP_ALLOWED"}"'):
        if marker not in web:
            fail(f"D165 Web resolved Skip correction missing: {marker}")
    for marker in ('correction_from_status: fromStatus', 'result_event_id: resultEventId || null', 'target: { batchId }', 'Báo hàng {sku}'):
        if marker not in business_api:
            fail(f"D165 Picker FCM correction metadata/target missing: {marker}")
    if 'WHERE a.result_event_id = ? AND a.target_user_id = ?' not in operational:
        fail("D165 Picker realtime authorization must remain exact-event targeted")

    # D165 PER_PICKER keeps the batch pending after timeout, so the business
    # resolver may compute queue_delta from remaining waiting tickets instead of
    # carrying the legacy unconditional -1 literal. FIRST_REPORT still closes.
    for marker in (
        'auto_skip_mode !== "PER_PICKER"',
        "final_batch_resolution: false",
        "overdue_delta:",
        'scopes: ["reporter_queue", "reporter_overdue", "picker_reports"]',
    ):
        if marker not in sla_auto:
            fail(f"D165 PER_PICKER timeout invariant missing: {marker}")

    # One exact counter endpoint is allowed for login/F5/reconnect/gap reconciliation.
    # Normal realtime events must not perform a count/read call.
    for marker in (
        "function reporterCounters",
        "queue_total:",
        "recent_total:",
        '"/operational/reporter/counters"',
    ):
        if marker not in operational:
            fail(f"D162 lightweight reporter counters endpoint missing: {marker}")

    # Live websocket broadcasts must carry the same queue/recent transition metadata
    # without a new provider or InventoryCore read.
    for marker in (
        "queue_delta?: unknown",
        "recent_counter?: unknown",
        "metadata.queue_delta = queueDelta",
        "metadata.recent_counter = payload.recent_counter",
        "GET /api/reporter/counters",
    ):
        if marker not in business_api:
            fail(f"D162 live reporter counter broadcast/route missing: {marker}")
    for marker in (
        "queue_delta?: -1 | 0 | 1",
        "recent_counter?:",
        "queue_delta: finalWaitingTicket ? -1 : 0",
    ):
        if marker not in sla_auto:
            fail(f"D162 live deadline reporter counter missing: {marker}")
    for marker in (
        "effect.queue_delta",
        "queue_delta: effect.queue_delta",
        "effect.recent_counter",
        "recent_counter: effect.recent_counter",
    ):
        if marker not in core:
            fail(f"D162 live deadline broadcast counter metadata missing: {marker}")

    schedule_pos = core.find("await scheduleNextOperationalAlarm(this.state);")
    broadcast_pos = core.find("for (const effect of effects) {", core.find("async alarm(): Promise<void>"))
    if schedule_pos < 0 or broadcast_pos < 0 or schedule_pos > broadcast_pos:
        fail("D070 alarm must reschedule authoritative work before best-effort delivery")


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

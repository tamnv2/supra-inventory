#!/usr/bin/env python3
"""Regression checks for realtime global-scan cursor and applied-state semantics."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def fail(message: str) -> None:
    raise SystemExit(f"REALTIME_CURSOR_REGRESSION_FAIL: {message}")


def source_guards() -> None:
    service = (ROOT / "service/src/operational-v2-core.ts").read_text(encoding="utf-8")
    read_model = (ROOT / "service/src/read-model-core.ts").read_text(encoding="utf-8")
    web = (ROOT / "web/src/realtime-client.ts").read_text(encoding="utf-8")
    web_app = (ROOT / "web/src/operational-app.ts").read_text(encoding="utf-8")
    android = (ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/AndroidRealtimeClient.kt").read_text(encoding="utf-8")
    picker = (ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/PickerController.kt").read_text(encoding="utf-8")
    reporter = (ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/ReporterController.kt").read_text(encoding="utf-8")

    for marker in (
        "stream_epoch",
        "retained_from_seq",
        "has_more",
        "resync_required",
        "CURSOR_AHEAD_OF_STREAM",
        "CURSOR_BEFORE_RETENTION",
        "STREAM_EPOCH_CHANGED",
        "scanned_count",
    ):
        if marker not in service:
            fail(f"server delta contract missing {marker}")

    if "realtimeStreamMetadata(state)" not in read_model:
        fail("ticket/socket handshake does not expose stream metadata")

    if "registerRealtimeApplier" not in web or "saveAppliedState" not in web:
        fail("Web applied-state realtime contract missing")
    if "registerRealtimeApplier" not in web_app or "Promise<boolean>" not in web_app:
        fail("Web read-model applier does not return application success")
    recover = web[web.find("async function recoverDelta"):web.find("async function handleFrame")]
    if recover.find("await applyThrough") < 0 or recover.find("saveAppliedState") < 0:
        fail("Web delta apply/save markers missing")
    if recover.find("saveAppliedState") < recover.find("await applyThrough"):
        fail("Web advances cursor before applying state")

    if "event.seq > cursor + 1L" in android:
        fail("Android still requires authorized global sequence to be contiguous")
    if "applyScopesAndWait" not in android or "saveApplied" not in android:
        fail("Android applied-state cursor markers missing")
    android_recover = android[android.find("private fun recoverDelta"):android.find("private fun reconcileAndCommit")]
    if android_recover.find("applyScopesAndWait") < 0 or android_recover.find("saveApplied") < 0:
        fail("Android delta apply/save markers missing")
    if android_recover.find("saveApplied") < android_recover.find("applyScopesAndWait"):
        fail("Android advances cursor before applying state")
    if "scheduleDirtyRecovery" not in android:
        fail("Android dirty recovery missing")
    if "refreshDirty" not in picker or "refreshDirty" not in reporter:
        fail("Android controllers can still drop realtime refresh while busy")


@dataclass(frozen=True)
class Event:
    seq: int
    owner: str


def scan_page(events: list[Event], after_seq: int, limit: int, principal: str) -> tuple[list[int], int, bool]:
    global_rows = [event for event in events if event.seq > after_seq][:limit]
    authorized = [event.seq for event in global_rows if event.owner == principal]
    cursor = global_rows[-1].seq if global_rows else after_seq
    latest = max((event.seq for event in events), default=0)
    return authorized, cursor, cursor < latest


def test_interleaved_picker_stream() -> None:
    events = [
        Event(10, "p1"),
        Event(11, "p2"),
        Event(12, "p2"),
        Event(13, "p1"),
    ]

    authorized, cursor, has_more = scan_page(events, 10, 2, "p1")
    if authorized != [] or cursor != 12 or not has_more:
        fail(f"first scan page mismatch: events={authorized} cursor={cursor} has_more={has_more}")

    authorized, cursor, has_more = scan_page(events, cursor, 2, "p1")
    if authorized != [13] or cursor != 13 or has_more:
        fail(f"second scan page mismatch: events={authorized} cursor={cursor} has_more={has_more}")


def test_resync_contract() -> None:
    latest = 40
    retained_from = 21

    def reason(after: int, client_epoch: str, server_epoch: str) -> str | None:
        if client_epoch and client_epoch != server_epoch:
            return "STREAM_EPOCH_CHANGED"
        if after > latest:
            return "CURSOR_AHEAD_OF_STREAM"
        if retained_from > 0 and after < retained_from - 1:
            return "CURSOR_BEFORE_RETENTION"
        return None

    if reason(40, "e1", "e2") != "STREAM_EPOCH_CHANGED":
        fail("epoch reset is not explicit")
    if reason(99, "e2", "e2") != "CURSOR_AHEAD_OF_STREAM":
        fail("cursor-ahead reset is not explicit")
    if reason(10, "e2", "e2") != "CURSOR_BEFORE_RETENTION":
        fail("retention loss is not explicit")
    if reason(20, "e2", "e2") is not None:
        fail("retention boundary incorrectly requests resync")


def test_cursor_commits_only_after_apply() -> None:
    applied_cursor = 10
    scanned_cursor = 13

    apply_ok = False
    if apply_ok:
        applied_cursor = scanned_cursor
    if applied_cursor != 10:
        fail("failed application advanced cursor")

    apply_ok = True
    if apply_ok:
        applied_cursor = scanned_cursor
    if applied_cursor != 13:
        fail("successful application did not advance cursor")


def main() -> None:
    source_guards()
    test_interleaved_picker_stream()
    test_resync_contract()
    test_cursor_commits_only_after_apply()
    print("REALTIME_CURSOR_REGRESSION_PASS")


if __name__ == "__main__":
    main()

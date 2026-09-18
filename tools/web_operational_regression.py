#!/usr/bin/env python3
"""Regression guards for Web operational P1 contracts."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def fail(message: str) -> None:
    raise SystemExit(f"WEB_OPERATIONAL_REGRESSION_FAIL: {message}")


def require(text: str, marker: str, name: str) -> None:
    if marker not in text:
        fail(f"missing {name}: {marker}")


def forbid(text: str, marker: str, name: str) -> None:
    if marker in text:
        fail(f"forbidden {name}: {marker}")


def main() -> None:
    app = read("web/src/operational-app.ts")
    api = read("web/src/api.ts")
    operational_api = read("web/src/operational-api.ts")
    users_core = read("service/src/user-management-core.ts")
    users_api = read("service/src/user-management-api.ts")
    service_index = read("service/src/index.ts")
    core = read("service/src/core.ts")
    read_model = read("service/src/read-model-core.ts")
    notifications_core = read("service/src/notifications-core.ts")

    # F08: realtime/search updates preserve active context instead of rebuilding the full shell.
    require(app, "function captureUiContext()", "UI context capture")
    require(app, "function restoreUiContext(", "UI context restore")
    require(app, "patchActiveSection(true);", "realtime active-section patch")
    require(app, "pickerSearchGeneration", "SKU search generation")
    require(app, "requestedQuery !== pickerQuery", "stale SKU response rejection")

    # F17: one session/refresh manager and cross-session stale response rejection.
    require(operational_api, 'import { authorizedFetch, readJson } from "./api";', "shared authorized client")
    forbid(operational_api, "SESSION_KEY", "second session store")
    forbid(operational_api, "function readSession", "second session reader")
    forbid(operational_api, "async function refresh(", "second refresh flow")
    require(app, "sessionViewGeneration", "session view generation")
    require(app, 'userId !== (profile?.user_id || "")', "cross-session response guard")
    require(api, "let refreshPromise: Promise<void> | null = null;", "single-flight refresh")

    # F18: no ambiguous prompt/confirm account edit semantics; password remains masked form input.
    forbid(app, "window.prompt(", "window.prompt managed-account editing")
    forbid(app, "OK = ACTIVE, Cancel = DISABLED", "cancel-means-disable behavior")
    require(app, 'id="edit-user-form"', "explicit user edit form")
    require(app, 'id="password-user-form"', "explicit password form")
    require(app, 'type="password" autocomplete="new-password"', "masked managed password input")

    # F10 carried into Web package: fetched != displayed.
    forbid(app, ".then(() => markPickerResult", "DISPLAYED chained immediately after RECEIVED")
    require(app, 'markPickerResult(visibleResult.result_event_id, visibleResult.batch_id, visibleResult.batch_version, "DISPLAYED")', "visible-result DISPLAYED stage")

    # F16: bounded server-side users query + one/many/all Picker operations.
    require(users_api, '"offset"', "user API offset forwarding")
    require(users_core, "COUNT(*) AS total", "user total query")
    require(users_core, "LIMIT ? OFFSET ?", "user SQL pagination")
    forbid(users_core, "LIMIT 1000", "fixed 1000-row user load")
    require(app, 'id="toggle-all-pickers"', "select all Picker UI")
    require(app, "updatePickerAccounts(action, ids, allPickerSelection)", "all Picker action propagation")

    # F15: approved dashboard/reporting controls.
    require(app, "renderDatePresets(", "shared date presets")
    require(app, "dashboardData?.timeline", "trend surface")
    require(app, "dashboardData?.outcomes", "outcome surface")
    require(app, "data-dashboard-sku", "dashboard drill-down")
    require(app, "async function exportReportsCsv()", "bounded CSV export")
    require(app, "limit: pageSize", "chunked reporting export")

    # SLA UI/server contract must agree.
    require(app, 'warning > 1440', "SLA warning upper bound")
    require(app, 'escalation > 2880', "SLA escalation upper bound")

    # D060: Root can temporarily lower its effective role, and the service—not the client—enforces it.
    require(api, "setRootEffectiveRole", "Root effective-role client API")
    require(app, 'profile.base_role === "ROOT"', "Root selector visibility guard")
    require(service_index, '"/api/auth/root-role"', "Root effective-role service route")
    require(service_index, 'actor.base_role !== "ROOT"', "Root base-role authorization")
    require(core, "role_override", "Root role override storage")
    require(core, '"/auth/root-role-override"', "Root role override core route")
    require(read_model, '"/realtime/close-user"', "role-change realtime revocation route")
    require(read_model, '"role-changed"', "role-change realtime close reason")
    require(notifications_core, "role_override", "effective-role FCM targeting")

    print("WEB_OPERATIONAL_REGRESSION_PASS")


if __name__ == "__main__":
    main()

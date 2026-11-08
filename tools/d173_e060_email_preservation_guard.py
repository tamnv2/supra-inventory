#!/usr/bin/env python3
"""D173-E060 strict non-mutation of existing mail/auth Worker source."""
from pathlib import Path
import subprocess

# Compare with accepted pre-E060 main: origin/main contains the E060 route
# after PR756 merge, and would falsely reject the intended isolated addition.
BASE_SHA = "be667eb7b54040423df74289902a5a3b4824a59a"
def old(path):
    return subprocess.check_output(["git","show",BASE_SHA+":"+path],text=True)
root=Path(__file__).resolve().parents[1]
protected=(
  "service/src/google-mail.ts",
  "service/src/system-reset.ts",
  "service/wrangler.beta.toml",
  "ops/d173-email-release-authorization.json",
  "ops/d173-email-sender-activation-authorization.json",
  "service/src/obpp1291-core.ts",
)
# E111 and subsequent signed Agent releases must compare protected resources to the
# currently accepted main merge-base, not an E060 pre-release SHA which has
# intentionally evolved in authorized intervening releases. No protected
# email/D172/Worker-index bytes may be changed by this candidate.
version = int((root / "relay-agent/VERSION").read_text().strip())
if version >= 150:
    accepted = subprocess.check_output(
        ["git", "merge-base", "origin/main", "HEAD"], text=True).strip()
    for path in protected:
        accepted_file = subprocess.check_output(
            ["git", "show", accepted + ":" + path], text=True)
        assert (root / path).read_text() == accepted_file, "PROTECTED_CURRENT_MAIN_CHANGED:" + path
    accepted_index = subprocess.check_output(
        ["git", "show", accepted + ":service/src/index.ts"], text=True)
    import os
    if version == 175 and os.environ.get("GITHUB_HEAD_REF") == "feat/d173-e169-diagnostic-attribution-20261108":
        # E170: existing E127 HMAC mode is already accepted in main. Verify
        # the newly approved daily read sits behind the identical signature
        # and leaves every other mail/auth and business route byte identical.
        current = (root/"service/src/index.ts").read_text(encoding="utf-8")
        import_line = "import { listRuntimeLogs, readRuntimeLog, uploadRuntimeLog, probeLauncherArchiveFolder, ensureLauncherLogsDestination, resolveRuntimeLogDayForAgent, collectD173AgentDriveEvidence } from \"./runtime-logs\";\n"
        old_line = "import { listRuntimeLogs, readRuntimeLog, uploadRuntimeLog, probeLauncherArchiveFolder, ensureLauncherLogsDestination, resolveRuntimeLogDayForAgent } from \"./runtime-logs\";\n"
        assert current.count(import_line) == 1, "E170_IMPORT_SCOPE_DRIFT"
        normalized = current.replace(import_line, old_line, 1)
        start = '        if (url.searchParams.get("mode") === "DAILY_EVIDENCE") {'
        after = '        if (url.searchParams.get("mode") === "LOG_ARCHIVE") {'
        assert normalized.count(start)==1 and normalized.count(after)==1, "E170_DAILY_SIGNED_ROUTE_MISSING"
        a=normalized.index(start)
        z=normalized.index(after,a)
        block=normalized[a:z]
        for marker in ["collectD173AgentDriveEvidence", "diagnostics/d173/daily-attribution",
                       "runtime-logs/d173-daily-coverage", "complete_fleet:false"]:
            assert marker in block, "E170_DAILY_EVIDENCE_SCOPE_INCOMPLETE:"+marker
        normalized=normalized[:a]+normalized[z:]
        assert normalized==accepted_index, "E170_MAIL_AUTH_INDEX_MUTATION"
        print("D173_E170_HMAC_ADDITIVE_DAILY_DIAG_ONLY__EMAIL_AUTH_IMMUTABLE_PASS")
        raise SystemExit(0)
    if version == 174 and os.environ.get("GITHUB_HEAD_REF") == "feat/d173-e165-tray-usage0530-dayline-20261108":
        # E167 exactly reconstructs accepted main after only the two permitted
        # additive scheduler deltas. All mail/auth/D172 business routes remain
        # byte-for-byte unchanged; unrelated Worker mutations fail closed.
        import json
        receipt=json.loads((root/"ops/d173-e165-agent174-release-authorization.json").read_text())
        assert receipt["log_protocol_approved"] is True and receipt["service_mutation"] is True
        normalized=(root/"service/src/index.ts").read_text()
        # Recovery after the first protected E165 merge: accepted main ALREADY
        # includes the two Owner-approved cron deltas. Require exact byte parity
        # instead of stripping those deltas twice and falsely reporting drift.
        if ("logDrainTime.getUTCMinutes() % 30 === 0" in accepted_index
                and "THIRTY_MINUTE_EXISTING_CRON" in accepted_index):
            assert accepted_index.count("logDrainTime.getUTCMinutes() % 30 === 0") == 1
            assert accepted_index.count("THIRTY_MINUTE_EXISTING_CRON") == 1
            assert normalized == accepted_index, "E167_RECOVERY_UNAUTHORIZED_WORKER_OR_D172_INDEX_CHANGE"
            print("D173_E167_RECOVERY_POSTMERGE_WORKER_INDEX_BYTE_IDENTICAL_PASS")
            raise SystemExit(0)
        for original,approved in [
            ("      ctx.waitUntil(runD173ScheduledMaintenance(env));\n", "      // E165: reuse the registered five-minute trigger; archive buffered Web\n      // logs only every 30 minutes while preserving the HR maintenance tick.\n      const logDrainTime = new Date(controller.scheduledTime);\n      // Existing 5-minute cron; archive pending bundles every 30 minutes.\n      // The reporting cutoff at 05:00 does not create extra client uploads.\n      ctx.waitUntil(runD173ScheduledMaintenance(env,\n        logDrainTime.getUTCMinutes() % 30 === 0));\n"),
            ("      // D171 E039: scheduled Web/server-only checkpoint, even with zero browsers.\n      // Existing five-minute cron already fires at 06:15/14:15 UTC,\n      // corresponding to 13:15/21:15 Vietnam. Do not scrape Web sessions.\n      const tick = new Date(controller.scheduledTime);\n      if (tick.getUTCMinutes() === 15 && (tick.getUTCHours() === 6 || tick.getUTCHours() === 14)) {\n        const slot = tick.getUTCHours() === 6 ? \"1315\" : \"2115\";\n        const vnDay = new Intl.DateTimeFormat(\"en-CA\", {\n          timeZone: \"Asia/Ho_Chi_Minh\", year: \"numeric\", month: \"2-digit\", day: \"2-digit\",\n        }).format(tick).replace(/[^0-9]/g, \"\");\n        const boundary = `server:scheduled:${vnDay}:${slot}`;\n        ctx.waitUntil((async () => {\n          const raw = await crypto.subtle.digest(\"SHA-256\", new TextEncoder().encode(\"WEB_SERVER|\" + boundary));\n          const bundleId = Array.from(new Uint8Array(raw), b => b.toString(16).padStart(2, \"0\")).join(\"\");\n          await uploadRuntimeLog(env, {\n            user_id: \"web-server\", employee_code: null,\n            display_name: \"Inventory Worker Scheduler\", role: \"SYSTEM\",\n          }, {\n            source: \"WEB\", severity: \"INFO\", reason: `scheduled_${vnDay}-${slot}`,\n            generated_at: tick.toISOString(), bundle_id: bundleId,\n            boundary_id: boundary, trace_id: boundary,\n            device: {device_id: \"inventory-worker\", platform: \"cloudflare-cron\"},\n            payload: {\n              format: \"d171-server-checkpoint-v1\",\n              slot_vn: slot, day_vn: vnDay,\n              source: \"SERVER_ONLY_NO_BROWSER_SESSION\",\n              server_archive_drainer: \"FIVE_MINUTE_EXISTING_CRON\",\n              browser_local_logs: \"SEPARATE_NEXT_ONLINE_SESSION\",\n              provider_usage: \"NOT_BILLED_USAGE_DO_NOT_INFER\",\n            },\n          });\n        })().catch(error => console.error(\"d171_server_log_checkpoint_failed\",\n          error instanceof Error ? error.name : \"ERROR\")));\n      }\n", "      // E165: Service owns a 30-minute persistent checkpoint regardless of\n      // Web visibility. Browser-only events must first reach InventoryCore;\n      // a server checkpoint is not proof a closed browser produced UI logs.\n      const tick = new Date(controller.scheduledTime);\n      const vnTime = new Date(tick.getTime() + 7 * 60 * 60_000);\n      // The checkpoint follows 00:00 and 06:00..22:00 VN. 30-minute cron\n      // drains existing outbox only; it must not create 48 idle logs/day.\n      if ((vnTime.getUTCHours() === 0 || (vnTime.getUTCHours() >= 6 && vnTime.getUTCHours() <= 22 && vnTime.getUTCHours() % 2 === 0)) && vnTime.getUTCMinutes() === 0) {\n        const slot = String(vnTime.getUTCHours()).padStart(2, \"0\") +\n          String(vnTime.getUTCMinutes()).padStart(2, \"0\");\n        const vnDay = new Intl.DateTimeFormat(\"en-CA\", {\n          timeZone: \"Asia/Ho_Chi_Minh\", year: \"numeric\", month: \"2-digit\", day: \"2-digit\",\n        }).format(tick).replace(/[^0-9]/g, \"\");\n        const boundary = `server:scheduled:${vnDay}:${slot}`;\n        ctx.waitUntil((async () => {\n          const raw = await crypto.subtle.digest(\"SHA-256\", new TextEncoder().encode(\"WEB_SERVER|\" + boundary));\n          const bundleId = Array.from(new Uint8Array(raw), b => b.toString(16).padStart(2, \"0\")).join(\"\");\n          await uploadRuntimeLog(env, {\n            user_id: \"web-server\", employee_code: null,\n            display_name: \"Inventory Worker Scheduler\", role: \"SYSTEM\",\n          }, {\n            source: \"WEB\", severity: \"INFO\", reason: `scheduled_${vnDay}-${slot}`,\n            generated_at: tick.toISOString(), bundle_id: bundleId,\n            boundary_id: boundary, trace_id: boundary,\n            device: {device_id: \"inventory-worker\", platform: \"cloudflare-cron\"},\n            payload: {\n              format: \"d171-server-checkpoint-v1\",\n              slot_vn: slot, day_vn: vnDay,\n              source: \"SERVER_ONLY_NO_BROWSER_SESSION\",\n              server_archive_drainer: \"THIRTY_MINUTE_EXISTING_CRON\",\n              browser_local_logs: \"SEPARATE_NEXT_ONLINE_SESSION\",\n              provider_usage: \"NOT_BILLED_USAGE_DO_NOT_INFER\",\n            },\n          });\n        })().catch(error => console.error(\"d171_server_log_checkpoint_failed\",\n          error instanceof Error ? error.name : \"ERROR\")));\n      }\n"),
        ]:
            assert normalized.count(approved)==1, "E167_APPROVED_CRON_FRAGMENT_MISSING"
            normalized=normalized.replace(approved,original,1)
        assert normalized==accepted_index, "E167_UNRELATED_WORKER_OR_D172_INDEX_DRIFT"
        print("D173_E167_EXACT_CRON_DELTA_MAIL_D172_IMMUTABLE_PASS")
        raise SystemExit(0)
    if (version == 166 and os.environ.get("GITHUB_EVENT_NAME") == "pull_request"
            and os.environ.get("GITHUB_HEAD_REF") ==
                "docs/d173-e140-picklist-confirm-guard-forensics-20261105"):
        # E140 only adds five exact signed Picker shift claims fragments.
        # Do not grant the superseded E127 diagnostics release exception.
        # All mail, D172 and unrelated Worker bytes remain exactly on main.
        subprocess.run(["python3", "tools/d173_e140_preflight.py"], check=True)
        subprocess.run(["python3", "tools/d173_e140_worker_index_delta_guard.py"], check=True)
        print("D173_E060_E140_SIGNED_PICKER_SHIFT_EXACT_ONLY_PASS")
        raise SystemExit(0)
    if version == 169 and os.environ.get("GITHUB_EVENT_NAME") == "pull_request" and os.environ.get("GITHUB_HEAD_REF") == "fix/d173-e146-agent169-picker-cutoff-20261107":
        # E146/E148 uses existing Cron to expire only Picker sessions and
        # leaves mail, OAuth, D172 and every unrelated Worker route unmodified.
        # Exact Owner/scope/Android/D172 proof is not inherited from E127.
        subprocess.run(["python3", "tools/d173_e146_source_guard.py"], check=True)
        index = (root / "service/src/index.ts").read_text(encoding="utf-8")
        added_import = 'import { runD173PickerShiftCron } from "./d173-picker-shift-cron";\n'
        block = (
            "      // E146: only exact VN 14:00/22:00 slot and bounded retry ticks.\n"
            "      // No new Cron trigger; no scan or Firestore write outside the slot.\n"
            "      const pickerShiftTick = new Date(controller.scheduledTime);\n"
            "      if ((pickerShiftTick.getUTCHours() === 7 || pickerShiftTick.getUTCHours() === 15) &&\n"
            "          pickerShiftTick.getUTCMinutes() <= 30) {\n"
            "        ctx.waitUntil(runD173PickerShiftCron(env, controller.scheduledTime).catch((error) =>\n"
            '          console.error("picker_shift_cutoff_failed",\n'
            '            error instanceof Error ? error.message : "unknown")));\n'
            "      }\n"
        )
        assert index.count(added_import) == 1 and index.count(block) == 1, "E148_SCOPED_CRON_FRAGMENT_MISSING"
        assert index.replace(added_import, "", 1).replace(block, "", 1) == accepted_index, "E148_UNRELATED_WORKER_INDEX_DRIFT"
        print("D173_E148_WORKER_INDEX_CUTOFF_ONLY__MAIL_D172_UNCHANGED_PASS")
        raise SystemExit(0)
    if version == 164 and 'import { d173PickerShiftIsExpired } from "./d173-picker-shift";' not in accepted_index:
        # Historic E123 branch only: reconstruct exact authorized deltas
        # BEFORE E123 was merged. After E123 is already in accepted main,
        # compare the full Worker index byte-for-byte without rewriting it.
        # E123 can add only six reviewed Picker-shift fragments in Worker.
        # Full byte equality still preserves mail, D172 and all other auth.
        import json
        receipt = json.loads((root / "ops/d173-e123-release-authorization.json").read_text())
        assert receipt["checkpoint_id"] == "D173-E123"
        assert receipt["worker_web_deployment_permission"] is True
        assert receipt["d172_business_mutation"] is False
        assert receipt["stable_deployment_permission"] is False
        replacements = [
                [
                        "import { InventoryCore } from \"./core\";\n",
                        "import { InventoryCore } from \"./core\";\nimport { d173PickerShiftIsExpired } from \"./d173-picker-shift\";\n"
                ],
                [
                        "  if (!identity.sessionGeneration || identity.sessionGeneration !== expected) return \"SESSION_REPLACED\";\n",
                        "  if (!identity.sessionGeneration || identity.sessionGeneration !== expected) return \"SESSION_REPLACED\";\n  if (identity.sessionChannel === \"ANDROID\" && user.base_role === \"PICKER\" &&\n      d173PickerShiftIsExpired(user.android_session_started_at, Date.now())) return \"PICKER_SHIFT_ENDED\";\n"
                ],
                [
                        "): Promise<{ generation: number; replaced: boolean } | { conflict: true }> {",
                        "): Promise<{ generation: number; replaced: boolean; pickerShiftLogoutAtMs: number | null } | { conflict: true }> {"
                ],
                [
                        "  const payload = (await response.json()) as { error?: string; session_generation?: number; replaced_other_device?: boolean };",
                        "  const payload = (await response.json()) as { error?: string; session_generation?: number; replaced_other_device?: boolean; picker_shift_logout_at_ms?: number | null };"
                ],
                [
                        "    replaced: Boolean(payload.replaced_other_device),\n",
                        "    replaced: Boolean(payload.replaced_other_device),\n    pickerShiftLogoutAtMs: Number.isFinite(payload.picker_shift_logout_at_ms) ? Number(payload.picker_shift_logout_at_ms) : null,\n"
                ],
                [
                        "      session_channel: channel,\n      ...(relayCustomToken",
                        "      session_channel: channel,\n      ...(channel === \"ANDROID\" && user.base_role === \"PICKER\" ? {\n        picker_shift_logout_at_ms: activated.pickerShiftLogoutAtMs,\n        picker_shift_server_now_ms: Date.now(),\n      } : {}),\n      ...(relayCustomToken"
                ]
        ]
        for before, after in replacements:
            assert accepted_index.count(before) == 1, "E123_INDEX_ANCHOR_DRIFT"
            accepted_index = accepted_index.replace(before, after, 1)
    # The E127 log incident adds only an HMAC-authenticated, aggregate-only
    # diagnostics mode to the already registered SQL evidence endpoint.
    # Strip that exact fragment and demand the entire remaining Worker index
    # byte-for-byte equals accepted main. Older E060/E123 protections remain.
    if (root / "service/src/index.ts").read_text() != accepted_index:
        fragment = (
            '        if (url.searchParams.get("mode") === "LOG_ARCHIVE") {\n'
            '          // Same short-lived HMAC trust as the existing GitHub read-only SQL\n'
            '          // collector. Returns only aggregate classifications, never payloads,\n'
            '          // row identifiers or OAuth secrets. No changes to public auth paths.\n'
            '          return json(await listRuntimeLogs(env, "DIAGNOSTICS", 1));\n'
            '        }\n'
        )
        current_index = (root / "service/src/index.ts").read_text()
        assert accepted_index.count(fragment) == 0, "E127_BASE_ALREADY_AUTHORIZED_DIAGNOSTIC"
        assert current_index.count(fragment) == 1, "E127_SIGNED_LOG_DIAGNOSTIC_SCOPE_DRIFT"
        assert current_index.replace(fragment, "", 1) == accepted_index, "E127_PROTECTED_INDEX_DRIFT"
        print("D173_E127_SIGNED_LOG_DIAGNOSTIC_INDEX_SCOPE_PASS")
        raise SystemExit(0)
    assert (root / "service/src/index.ts").read_text() == accepted_index, "PROTECTED_CURRENT_MAIN_CHANGED:service/src/index.ts"
    print("D173_E060_CURRENT_MAIN_EMAIL_D172_INDEX_IMMUTABLE_PASS")
    raise SystemExit(0)

for path in protected:
    assert (root/path).read_text()==old(path), "PROTECTED_EMAIL_OR_D172_CHANGED:"+path
current=(root/"service/src/index.ts").read_text()
baseline=old("service/src/index.ts")
current=current.replace('import { collectVpsUsage } from "./d173-vps-usage";\n',"",1)
current=current.replace('  D173_CF_EMAIL_ANALYTICS_READ?: string;\n  D173_CF_ZONE_ID?: string;\n',"",1)
mark="      // D173-E096 exact named privileged logins, read-only usage monitoring."
next_route='      if (request.method === "POST" && url.pathname === "/api/agent/d166/usage") {'
assert current.count(mark)==1 and current.count(next_route)==1
start=current.index(mark)
stop=current.index(next_route,start)
block=current[start:stop]
for required in (
    'GET" && url.pathname === "/api/agent/vps-usage"',
    'requireAgentUser(request, env, ["ADMIN", "PICKPACK_ADMIN"])',
    '!["vps", "admin", "tamnv2"].includes(String(operator.employee_code || "").trim().toLowerCase())',
    'collectVpsUsage(env,window)',
):
    assert required in block, required
assert "sendProjectEmail" not in block
assert "coreStub(" not in block
current=current[:start]+current[stop:]
assert current==baseline, "WORKER_INDEX_CHANGED_OUTSIDE_NEW_VPS_READONLY_ROUTE"
print("D173_E060_EXISTING_MAIL_AND_D172_BYTE_EXACT_READONLY_ROUTE_PASS")

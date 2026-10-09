# D166 — SKU Recorder field repair and native Service import impact review (09/10/2026)

Status: **BROWSER/ZIP SAME-POC REPAIR IMPLEMENTED ON PR #524; DIRECT SERVICE IMPORT DESIGN ONLY, NOT APPROVED FOR MUTATION**.

## Field feedback

Owner shared an actual Recorder error popup (generic ZIP export failure) and requested:
1. Direct-open `https://wms-supra.winmart.vn/sft3/app/report/bin-inventory`.
2. Explore transferring the downloaded SKU file **directly to the Inventory Service**, without opening or logging into the Web upload form.
3. Repair the ZIP export failure.

### 1. Direct navigation

`sku-browser-recorder/RecorderForm.cs` sets `WmsStart` to the Owner-supplied report/bin-inventory UI route, for initial WebView2 navigation and the existing manual **Bin Inventory** action. The hostname is already registered in `ops/project-scope.json` (`supra-wms-ui-d080`). This is still UI-only; it does not call the WMS API or scrape SKU data. Login redirects/MFA remain under the website's own controls.

### 3. ZIP export root cause confidence and repair

**Verified source defect:** v1 used one `SUPRA_SKU_Recorder_<runid>.zip` per process and deliberately rejected repeated exports from the same session with `File.Exists(destination)`; meanwhile its catch swallowed all exception details and showed the identical generic error. Thus *repeat-export filename collision is a proven failing case*, but it is **NOT proved** from the screenshot whether the Owner hit that case or an actual Desktop permissions/OneDrive/I/O problem.

**Repaired:** each export creates a new immutable timestamp+random filename, stages the archive under a unique `.partial` file in the destination folder, validates creation and renames to final without clobbering previous ZIPs. The operator-visible export first tries Windows Desktop then LocalAppData\SUPRA\SKU-Recorder\Exports as backup, shows the successful full local path, or displays privacy-safe error categories and HResult for both locations if neither works. The raw event log remains at LocalAppData\SUPRA\SKU-Recorder\Logs until completion. ZIP contents are local sanitized JSONL+manifest only, no credentials or WMS contents. Self-test executes *two exports in the same run* and checks both ZIPs and that the second contains an event recorded between exports.

### 2. Native direct-to-Service import: feasible, but not authorized yet

**Actual source proof:**
- Existing Beta Worker `POST /api/admin/skus/import` exists (`service/src/business-api.ts`) and delegates to InventoryCore `/business/skus/import-v2`. It enforces active user roles `ADMIN / PICKPACK_ADMIN / ROOT` and valid `WEB/ANDROID` interactive-session generation. The management route rejects ANDROID writes. A Firebase Agent session is **not** a WEB session, so simply reusing its token for this endpoint would return authorization failure.
- `web/src/sku-excel.ts` validates `.xlsx`, 50 MB, 10k–50k rows, safe SKU text, header identification, duplicate/conflicting product names and SHA256 source hash. `web/src/api.ts#importSkuChunk` submits chunks with source hash, `request_id`, dry run and `confirm_name_changes`. `sku-import-core.ts` enforces idempotency/preview/conflict-confirmation and additive/no-delete SKU semantics.
- A native app cannot treat an Agent WMS browser cookie as Inventory authentication authority. No shared anonymous upload URL or implicit role escalation.

**Recommended next stage after explicit Owner permission:** a scoped Beta-only native import authority flow, independent from Agent confirmation/HA: (a) native Recorder signs in with approved Inventory credentials/one-time-code or obtains a short-lived, server-authorized narrow **SKU_IMPORT** proof from a privileged Agent session through an explicitly reviewed local IPC handoff; (b) validate downloaded `.xlsx` with the same rules as Web, local preview counts and conflicts; (c) explicit operator **Nhập vào Service** confirmation, after secure authorization, using bounded chunks and deterministic `request_id`; (d) fail closed on name conflicts and require explicit name-change confirmation; (e) verify authoritative catalog version/count and audit final state before reporting DONE; (f) preserve local file and logs if network/retries fail; (g) no additional provider polling/listeners/Firestore or WMS API calls.

For minimal coupling, **recommended authentication is independent Inventory native login**, not copying or exporting Agent's existing Firebase credential. It avoids modifying the deployed Agent and prevents a second app from inheriting broad Agent privileges silently. Discuss approved roles/code-login semantics and the administrative role boundary before implementation; a new narrowly scoped Beta API may be necessary if currently supported Agent sessions must be reused. If no new auth approved, continue using the current secure WEB import, manual only.

**New API/role/auth changes are NOT included in this PR, and no Service upload/auto-import will run.** D126 remains active until superseded with explicit Owner-approved new decision. No production deployment, no primary Agent or Stable mutation.

## Risk and acceptance

- User-facing browser/ZIP repair does not alter Agent EXE, Web, Android, Worker, RTDB, Firestore, Confirm Picklist or HA/ACK logic.
- Use the compiled standalone POC only on **standby not performing picklist confirmation**: shared WebView2 profile/process still creates potential DevTools target ambiguity in the unchanged Agent.
- Technical CI self-test and source guards can PASS; real browser/session and exact Owner ZIP failure reproduction remain **FIELD PASS PENDING**.
- Retain Owner's operational failure evidence as a reported symptom. Do not claim filesystem/root cause proven solely by code inspection.
- Branch → PR → authority/continuity PASS → merge, no direct main pushes. Stable remains OWNER-GATED.

## Windows CI root-cause confirmation and fixed artifact (09/10/2026)

**Reproduced FAIL:** Windows test run `37940857513` failed during the **first ZIP export** with `IOException HResult=0x80070020` (sharing violation). The true original cause was not just filename reuse: `SafeEventLog` held `events.jsonl` open for WRITE, while `ZipFile.CreateEntryFromFile` opened the same source with `FileShare.Read`, which refuses the existing writer under Windows' bidirectional file-sharing rules. Generic popup previously concealed this.

**Source repair:** stream the existing log file into a ZIP entry through an explicit `FileStream(FileAccess.Read, FileShare.ReadWrite)` while holding the event writer lock, preserving consistent read and avoiding closing the logger. Retain unique-name/nonoverwrite exports and Desktop → LocalAppData fallback with categorized safe error reporting.

**Regression PASS:** Windows workflow `37940935150` passed compilation, source privacy guard, and an executable headless test that exports **two ZIPs in one session**, verifies distinct names, and checks the second ZIP includes events added after the first. CI artifact `11620328949` `D166-SKU-Recorder-win-x64` is a POC test candidate, not a verified Owner device/field PASS. SHA-256 is included in the artifact. No change to Agent/WMS confirmation code or production Service/Android/Web/Worker/Stable.

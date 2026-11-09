# D172-E061 — Signed OBPP Android login / pending OTP correction (09/11/2026)

## Owner field failure and verified source root causes
- Owner reports OBPP v10 login using either currently valid privileged one-time code or ordinary account password remains on Login without opening the app.
- Source verified at exact signed `obpp1291-v10` tag: successful `/api/obpp1291/session/login` stores opaque session and calls `refreshAll()` but never `showWorkplace()`. Only relaunch with saved session calls `showWorkplace()`. Thus successful login needlessly remains on Login even while asynchronous Cloud fetch succeeds.
- Owner requests a new privileged OTP and sees HTTP409 `CODE_PENDING_UNTIL_CONSUMED`; Android maps all 409 responses to unrelated business-row revision message. Existing one-use pending OTP is protected by server authority. Do not force a reset or bypass.

## Owner-approved corrective scope
Owner message: **"ok chốt, triển khai."** Approves independently signed **D172 Android APK only** correction and release. No Worker, Firebase identity/rules, Google Sheet, service business code, Inventory Web/Agent/Android, old Stable, secret or new provider resources.
1. After valid `session_token`, eligible role and non-empty account `cache_owner`, call `showWorkplace()` immediately after `bindHistoryOwner(res)`, independently of network/history refresh. Retain existing draft restoration, encrypted session persistence, `refreshAll()`, async local-first history, and authentication failure behavior.
2. Only for `POST /api/auth/privileged-code` returning 409 `CODE_PENDING_UNTIL_CONSUMED`, show "Đã có mã đăng nhập chưa sử dụng. Vui lòng dùng mã trong email quản trị." Other business HTTP409 retain record-conflict handling. Existing OTP consume/rotate/retry protections unchanged.
3. Add automated contract test to D172 APK PR CI plus normal Gradle unit/debug/release-disposable-key validation.

## Change and release gates
- Protected baseline main before change: `dc3bb4a9aea7693a7e006d860e2fc9632251de0d`.
- Reviewed Android-only source+test+Android CI pin: `234247c31020dbd6751c6966d565da604b509eb5`; **this pin is not proof CI PASS**.
- Existing deployed Worker E060 source: `07da381aba617644d90df1f72651fc2bd5876b68`, receipt GitHub run `42644816525`. The signed APK workflow checks exact existing Worker source/health and negative invalid-user login, rather than requiring the new Android merge SHA to be deployed to Worker.
- E061-specific release gate validates exact source paths, Owner authorization, protected main merge subject `D172-E061_ANDROID_ONLY:`, and disallows any independent Worker deployment or D173/Stable mutation. Prior E060 Worker-only release authority remains separate.
- All CI, signed APK, OTA manifest SHA/version and physical PDA login must be verified independently. D172 **PENDING/HOLD** until explicit Owner close.

## Status at code staging
**CODE PATCH STAGED / CI PENDING / SIGNED RELEASE PENDING / FIELD PENDING / OWNER PASS FALSE**. Never claim a real-device login PASS from source review or PR checks.

## R1 — release gate recovery after protected squash merge
- PR #885 merged as protected main `7fc185409411b0fea3d0bee2008eacb95ebe4c37`. PR exact-source D172 Android, Backend, UI, Authority/State CI PASS.
- Signed OBPP workflow `42660795259` **FAILED at gate** (`E061 exact reviewed source ancestry missing`). Original source pin `234247c31020dbd6751c6966d565da604b509eb5` is an ancestor of immutable PR #885 head, but GitHub squash main has a new SHA; requiring it be main's ancestor is incorrect. No APK v11 published in that run.
- Scoped repair fetches immutable `refs/pull/885/head` and asserts exact PR head + reviewed source SHA relationship, unchanged protected executable diff from source to main (only E061 release gate/workflow), and existing Worker E060 health. No Kotlin, credential, Sheet, Worker or D173 runtime code changes.
- Workflow's already registered path triggers a new signed release on the subsequent protected D172-E061 recovery merge. CI/RELEASE/FIELD/OWNER statuses remain independently verified; D172 HOLD.

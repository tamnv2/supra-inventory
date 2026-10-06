# D164 Architecture

`PDA Management APK -> pda-beta.supra.cc.cd -> supra-pda-management-beta Worker -> PdaManagementCore`.

PdaManagementCore is authoritative. `SUPRA_PDA_MANAGEMENT_BETA` is mirror/audit. Existing PDA Registry is read-only device discovery.

Inventory Báo hàng and PickList confirmation do not call PDA Management on their normal paths.

Independent scopes may run in parallel. If two changes both need HR, Inventory auth, Firebase rules, PDA Registry schema, shared signing/provider settings, or any shared Sheet tab, the second arrival pauses until the first shared-boundary change is PASS.

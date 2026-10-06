# SUPRA PDA Management — D164

Independent PDA asset-management scope inside the shared repository.

## Hard boundaries
- Inventory remains under `service/`, `web/`, `android/`.
- PDA Management lives only under `pda-management/**`.
- Android release tags use `pda-mgmt-beta-vc<N>`; never Inventory `beta-vc<N>`.
- PDA Management workflows do not call Inventory build/deploy workflows.
- Shared HR/auth/Firebase/PDA Registry schema/signing/provider boundaries require an explicit conflict check before mutation.

## Data
- Management Sheet: `SUPRA_PDA_MANAGEMENT_BETA` — `1q0XKgsU3AZQPIiX7AW6XxXh1Jfc--P1TmErdemAMUQg`
- Registry source: `SUPRA_PDA_REGISTRY_BETA` — `1zPwYzM6DWqVMI0rV_IRMJUH9nZwrlHQA997JRUD8pyI`

## Usage policy
No heartbeat. No Android background polling. No Firebase for MVP. Use revision/ETag validation, event-driven idempotent mutations, bounded retry, and asynchronous Sheet mirroring outside the critical transaction path.

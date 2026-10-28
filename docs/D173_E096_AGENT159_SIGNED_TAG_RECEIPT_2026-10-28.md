# D173-E096 — Agent159 signed tag receipt; OTA channel unverified (28/10/2026)

## Owner-approved scope
Owner explicitly authorized release of PR791's Agent UI repair in D173-E096. Signed Agent159-only candidate PR792 changed the installed-build sidebar label and source-backed colored day/month Usage progress. The target-known/actual-unknown month case intentionally shows a tinted hatch, not fabricated usage. No Worker, Android, Web, Firebase, Gateway, OBPP D172, Stable, or business data migration.

## Source and technical evidence
- UI source PR [#791](https://github.com/tamnv2/supra-inventory/pull/791): 28/28 source CI PASS.
- Owner-scoped signed Agent159 PR [#792](https://github.com/tamnv2/supra-inventory/pull/792): reviewed source commit `ffe4ff188d2e0c6d4a9deccfe3dc3df0d24c87e5`, 32/32 PR CI PASS including native Windows build, D172 isolation, authority/continuity and UI Design. After pin-only authorization commit `15dc01c89816259a55bc1739837b2f4f5cd70c67`, final PR CI also 32/32 PASS. Protected merge (not squash) SHA `263eec5883253dd3fd3544e4729e52729727c702` has exact `D173-E096_AGENT159_ONLY_RELEASE:` owner release marker.
- GitHub connector returned a resolvable `relay-agent-v159` commit/tag reference at SHA `263eec5883253dd3fd3544e4729e52729727c702`. `relay-agent/VERSION=159` resolves through that tag. This is proof of the versioned release tag's presence and source provenance only.
- Existing Agent158 release remains the retained rollback reference.

## Verification boundary
The connected GitHub action for commit workflow runs returns PR-triggered runs only, not main push release runs. Available tools could not read the main signed-EXE workflow's final conclusion or inspect `inventory-channel` release asset `agent-latest.json` and actual EXE SHA-256. Therefore **channel upload, equality of dedicated-v159 and channel EXE, full RELEASE PASS, installation on the VPS, FIELD PASS, and OWNER PASS are NOT VERIFIED**. A Git tag existing is not sufficient evidence for those claims.

Verification required on GitHub UI or an authorized API with release-asset read capability: (1) check main commit `263eec...` Verify Beta Relay Agent workflow finished SUCCESS; (2) verify dedicated `relay-agent-v159` EXE and checksum; (3) read `inventory-channel/agent-latest.json` tag=relay-agent-v159, size and SHA; (4) verify channel EXE SHA equals the dedicated asset; (5) inspect installed real VPS UI at light/dark and RDP DPI. This receipt does not authorize a new release or Worker/Firestore deployment.

## Phase status
CODE PASS; exact source/PR CI PASS; protected merge PASS; version tag PASS; OTA CHANNEL UNVERIFIED; FIELD PENDING; OWNER PASS PENDING. D172 independent PENDING/HOLD, Stable OWNER-GATED.

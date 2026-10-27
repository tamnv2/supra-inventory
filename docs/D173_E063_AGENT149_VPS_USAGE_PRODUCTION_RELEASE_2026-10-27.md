# D173-E063 — VPS-only Usage Worker + Agent v149 technical release receipt (27/10/2026)

## Source and protected release

- Owner-approved D173-E060 scope: existing registered Worker/InventoryCore, official `inventory.supra.cc.cd`, current Windows Agent v149 with read-only Usage tab visible only for exact `vps` account. No new Worker, Gateway, Firestore Rules, Android/Web, D172 business or historical Stable release.
- PR [#756](https://github.com/tamnv2/supra-inventory/pull/756) merged main `7d23d85eda21fa4275933cab2959950ae9f611f6` after 35/35 CI but its original push release was blocked on legacy same-SHA Gateway/Firestore waits. No inference of release for that merge.
- Recovery PR [#757](https://github.com/tamnv2/supra-inventory/pull/757) fixes precisely those release workflows, preserves byte-exact unchanged Gateway/Firestore/D172 checks and the pre-E060 mail/OBPP guard, and restores Worker-first ordering. Recovery source `21ae85182a7c4cab4e301d17f2997d210d96995d` has 22/22 protected PR workflow SUCCESS; final PR head `a659f988a4c28abf0ca3722a4b74720d9a861faa` also 22/22 SUCCESS. Authorization `ops/d173-e060-usage-release-authorization.json` pinned that source. Protected merge with `D173-E060_USAGE_RELEASE:` marker produced main `13d001920f0754deb552c803d9cd13d6827c2f8d`.

## Runtime provider and channel evidence

- Existing Production Worker GitHub Actions [run 40445546441](https://github.com/tamnv2/supra-inventory/actions/runs/40445546441) **completed/success**, exact merge SHA `13d0019`. Steps `D171 existing Gateway verified before Worker and Web`, `Deploy Beta Worker, Web assets and Durable Object`, `Verify Beta health, Root secret and SQLite schema`, `D173 install existing Zone Analytics Read secret for VPS-only Usage`, `D173 verify VPS endpoint rejects unauthenticated requests` are SUCCESS. Host is official `inventory.supra.cc.cd`; registered physical worker retains historical technical beta name.
- Windows Agent GitHub Actions [run 40445546328](https://github.com/tamnv2/supra-inventory/actions/runs/40445546328) **completed/success**, same exact main source SHA.
- Immutable [release tag `relay-agent-v149`](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v149) points to `13d001920f0754deb552c803d9cd13d6827c2f8d`, published 2026-10-27 03:43:56 UTC (10:43:56 VN). Asset `Agent.Auto.Confirm.Pick.Pack.exe` is 8,701,440 bytes, SHA-256 `f4453dcd3199e7d5ea1eb1cd457544d7e232e0531f50bf0feefea1f6478fa6e4`.
- Existing `inventory-channel` release EXE asset refreshed 2026-10-27 03:43:58 UTC and has the **identical** 8,701,440 bytes and SHA-256 `f4453dcd3199e7d5ea1eb1cd457544d7e232e0531f50bf0feefea1f6478fa6e4`. Its `agent-latest.json` asset updated at 03:43:57 UTC. This proves distribution files match. It does **not** prove every installed Windows Agent fetched or installed them.

## Pass boundaries

- **CODE PASS; CI 22/22 PASS; Worker RELEASE PASS; signed Agent v149 tag + channel asset/digest RELEASE PASS.**
- **FIELD PENDING; OWNER PASS PENDING.** Need installed VPS login `vps` to show Usage tab, numeric table and 24h/7d/30d charts/refresh, exact role restriction, stale/provider permission N/A behavior; confirm no WMS/Picklist/PRIMARY/Office/HA regression. Other login must not see/fetch Usage. No physical Windows screen inspection has been performed by this receipt.
- Gmail/Cloudflare credentials stay in registered Worker or GitHub protected environments, never EXE/public repo. Provider quota/cost coverage and real-time/5-minute availability are not claimed beyond observed tests; Cloudflare cost optimization still requires matched provider billing usage comparisons.
- D172 OBPP1291 remains independent **PENDING/HOLD**, no closure implied. Historical Stable remains OWNER-GATED. This is docs-only status: do not trigger another Worker/Agent/Android deployment from E063.

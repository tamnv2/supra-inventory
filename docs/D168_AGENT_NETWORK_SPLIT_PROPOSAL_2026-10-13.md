# D168 — Đề xuất phân tuyến Office / PDA Internet cho Windows Agent v130
2026-10-13 · **PROPOSAL / Owner chưa duyệt code hoặc triển khai** · cùng D168 (không tạo D mới)

## Authority/evidence đã xác minh
- `ops/authority-manifest.json` và toàn bộ bootstrap trên main; accepted runtime D167 Agent v130 Beta, fleet install/field PASS chưa toàn diện. D168 PR590 docs-only đã merge. Stable OWNER-GATED.
- D090 physical Office 2026-09-21: WMS UI/API read-only PASS, Firebase secure-token PASS, Firestore/Apps Script/Sheets/Drive host reachable, RTDB corporate-proxy HTTP403, Cloudflare Inventory trực tiếp không truy cập.
- D091 OA012 Owner **FIELD PASS**: Picker PDA → Firestore → Office Agent → Firestore ACK → PDA. Test ban đầu transport-only, không tự chứng minh mọi chức năng v130/HA.
- D093–D097 owner-action probes có biến động/fail/supersession trong kết quả hồi quy khi chuyển network; không coi toàn bộ chuyển mạng là FIELD PASS.
- D158 OA086 Owner field accepted gateway on Office ở phiên bản cũ, không thay thế D168 lỗi Gateway/UrlFetch và thiếu SKU durable DONE bản hiện tại.
- D168-REQ-008: Agent gateway log-upload timeout 10s vs potential 15s backend lock, 2 máy gặp DEFER dù Firebase/Firestore vẫn có PASS; D168-REQ-009: 948 SKU retry DEFER, deadline 15 phút bị readiness sự kiện phá, chưa có `DELTA_19 DONE` và quota UrlFetch quá nhiều lần.
- Source `relay-agent/AgentConfig.cs`, `AgentUpdater.cs`, `FirestoreConfirmationTransport.cs`, `FirestoreAgentLeaderCoordinator.cs`, `RtdbHaLiveness.cs`, `D167SkuServiceClient.cs`, `D167SkuBrowserExport.cs`, `D167SkuDirectExport.cs`, `AgentLogUploadBridge.cs`; current D143/D144 chat/call and D165 management specs.
- Reference pricing: Cloudflare Workers Paid min $5/month, includes 10 million Worker requests/month and 30 million CPU-ms/month, billed above; DO SQLite/storage/other meters are separate. Standard Cloud Firestore free tier (one qualified DB/project) 50k reads + 20k writes + 20k deletes/day; actual billed use, account sharing, region, operation costs require measured verification. Firebase Authentication, FCM, Firestore, RTDB and Google Apps Script quotas are distinct; do not add units.

## Three alternative approaches
A. **No change / measure:** Office WMS + Firebase/Firestore + existing Google gateway to Worker; record usage/ack/latency and repair already-known retry failures. Low regression; leaves gateway quotas.
B. **Single Wi-Fi auto toggle Office↔PDA per action:** direct Worker becomes reachable while on PDA, but current PRIMARY loses WMS connectivity, WebView2 context may expire, Firestore/HA may flap, standby takeover/duplicate Picklist risks, plus reconnection delay; NOT RECOMMENDED as default or on critical operations.
C. **Owner- and IT-authorized simultaneous separate adapters/links:** e.g. Office Ethernet/Wi-Fi and PDA second Wi-Fi/USB; explicit endpoint-class route/proxy on the allowed adapter with telemetry and isolated requests, no cross-network bridging. Strongest target if approved and technically proven. Windows default route alone does not guarantee per-endpoint egress or bypass system proxy; no private Office routing through Cloudflare/PDA NAT.
D. **Office-first, Google gateway minimal bridge:** use existing registered Google host to forward bounded, authenticated, idempotent SKU jobs/critical logs to Worker/Drive; optimize retry, status, batch/dedup, quota and confirmation. Recommended NOW; does not require Wi-Fi switching. Cloudflare remains processing/data authority; Google only narrow transport overhead.

## Recommended per-function network
| Chức năng | Preferred source network/carrier | Reason / boundary |
| --- | --- | --- |
| Agent ADMIN login and refresh | Firebase Auth over Office **or** Internet | Current direct auth with DPAPI session; does not need Worker; privileged D165 OTP is separate Google Gateway flow |
| WMS browser login/Confirm, manual search/confirm | Office WMS | Critical, session and response sensitive; never cut network for auxiliary work while PRIMARY/confirm active |
| PDA PickList request/ACK and multi-Agent generation/role/guards | Firebase Firestore over Office or Internet | D091 Owner Field PASS; already scoped, latency and idempotency critical; RTDB liveness optional Internet-only, Office Firestore lease fallback must be HA field-tested |
| Online Picker list/presence, fleet schedule, low-rate cross-Agent status | Existing compact Firestore projection/listener | Already event-driven; do not introduce Cloudflare polling or duplicate presence writes |
| Gọi về bàn CV | Keep Firestore active-call lock and Android exact-doc listener + FCM fast path | 60s bounded full-screen critical flow; Cloudflare direct Office blocked, network switching mid-confirm unacceptable |
| Chat Picker | Keep Firestore session-control exact-doc listener and compatible FCM fast path | Current D144 200-char/30-min model, no new polling; switching provider requires Agent+Android+Function/Worker changes for little proven saving |
| Group message/group call | D168 backlog only; not released; prefer current per-Picker Firestore/FCM with batching/limits only after design/measurement | Consent, per-recipient success/ACK, online generation, burst and quota constraints |
| Kích User / revocation / account authority | Firestore session-control signal **plus authoritative Worker revoke** | Cannot replace/omit Worker server revocation; Office route requires pre-existing safe server-mediated bridge, not direct Worker |
| SKU read-only WMS XLSX acquisition | Office WMS | Extract once when PRIMARY and browser ready; process normalization/fingerprint locally without provider request |
| SKU schedule/stage/preview/publish/DONE | Existing Google Apps Script → Worker InventoryCore on Office; future direct Worker if authorized permanent PDA link exists | Keep Worker CAS, day/slot/generation and DONE authority; repair existing retry-storm, quota, redirect and 500-SKU batch; no local fake DONE |
| Error/crash support log | Local-first, existing Google Gateway to Drive with positive DRIVE_SYNCED receipt; fallback pending local | Must not defer urgent incidents just for Wi-Fi switch; repair current 10s/15s timeout and single-flight/readback |
| Routine/support logs & large diagnostics | Prefer low-rate batched direct Cloudflare ingestion **only on already present Internet link**; otherwise existing Google route or bounded local pending until safe transfer | No new per-event writes, no direct-to-Sheet transaction, no removal of Drive as archival/confirmed-prune authority; real costs/volume need comparison |
| Agent update EXE/browser bundle, manual Usage ZIP, heavy Cloudflare reads | PDA Internet when already connected, on-demand/idle, prefer standby maintenance | Current update manifest starts on Cloudflare; never auto switch PRIMARY Wi-Fi for update or break WMS; GitHub CDN alone insufficient |
| Local UI/Excel parse/support journal, per-PC diagnostics | Local | No network; separate local success from server ACK |
| Web and Android shortage transactions | Continue Worker/InventoryCore and current realtime/FCM independently | Outside direct Agent routing change; never move ordinary Báo hàng through Agent/Firestore or allow offline mutation |

## Auto switch Wi-Fi feasibility and safety
- Supported technically on Windows via Native Wi-Fi `WlanConnect` API or `netsh wlan connect` using pre-existing authorized saved profiles. It returns before endpoint connectivity is confirmed; wait for OS notification + endpoint-specific ACK. Enterprise Wi-Fi may require interactive auth and policy may prohibit programmatic connection or simultaneous adapters.
- **Not safe to turn on unattended for current PRIMARY.** A single Wi-Fi radio switches the active connection; prior Office WMS TCP/WebView2 sessions can drop, login expire and Firestore/RTDB clients reconnect. A successfully returned Wi-Fi connect call does not prove business connection ready.
- Restrict experimental switching to **manual scoped maintenance**, only if no in-flight WMS confirm, unconfirmed ACK, live SKU claim/stage, Agent handoff or critical call; prefer non-primary standby with adequate remaining HA capacity. Require an explicit, confirmed lease/role handoff; if not available, refuse switch. Auto switch back with no rapid flap loops, bounded timeout and visible nonready status; fail closed, do not claim WMS operation success before authoritative ACK.
- Preferred instead: **keep Office continuously for PRIMARY**, maintain existing low-volume Google/Firestore Office carrier; only on approved dual independent links route trusted direct Worker operations via PDA link with OS per-destination verification and corporate IT authorization. Never circumvent corporate firewall by forwarding Office intranet resources through public network, ICS, NAT or VPN.
- Network identity in logs must be class/status only (OFFICE/PDA/UNKNOWN, endpoint, transport/error class, elapsed); do not store raw SSID/BSSID, IP, WMS auth headers, tokens, messages.

## Cost and regression comparison
- Direct Cloudflare while safely reachable reduces **Google Gateway intermediary** calls and UrlFetch dependency, but adds Worker requests, CPU, Durable Object/SQLite/archive costs where relevant; no savings if an unsafe Wi-Fi switch drops WMS/ACK, creates resync, or duplicates work.
- Messaging/call currently targeted 1 Picker, a few Firestore operations + FCM; swapping for Worker may still require FCM and per-recipient session/online state, therefore savings unproven. First measure 1 action → actual Firestore billed document reads/writes/deletes, Functions, FCM, Worker CPU/requests, local RTT and Android battery.
- Highest immediate leverage from D168 logs: eliminate hundreds of repeated SKU schedule retries and fix log Gateway timeout/single-flight before changing provider routes.
- Before any executable change, compare existing 1-shift/7-day baseline against candidate on identical volumes and region, include Google Apps Script UrlFetch quota and price meters separately. Regression matrix: Office-only, PDA-only, both adapters, failover PRIMARY/NEXT_A, in-flight WMS/ACK, login, chat/call, 05/12/19 SKU, Drive ACK, quota exhausted, Windows resume/reconnect and no-Internet fail-closed.

## Permission/state
Owner is discussing/proposing; **NO APPROVAL for code, Agent release, Worker/Gateway/Firestore/Android/Web mutation or Beta/Stable deploy.** No new provider resource or corporate network configuration authorized. Current D168 pending proposals and D167 deployed runtime remain unchanged.

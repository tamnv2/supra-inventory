# D169 Firebase network diagnostic — Owner approved 2026-10-17

The Owner approved an isolated Windows EXE with three main buttons to select ordinary Internet network, select company Office network, and launch a test. On the first run the operator may authenticate with existing Agent credentials, then keep the utility open and change Wi-Fi to run a comparable authenticated diagnostic with the same in-memory session.

The diagnostic must collect DNS/TCP/TLS/HTTPS direct and Windows system proxy results for Beta Firebase services. It checks Firebase Auth token refresh, Firestore exact REST reads and HTTP2 capability, RTDB HA read and SSE initial framing. It exports safe JSON/TXT reports to Desktop. No Firebase writes, PickList, WMS, HA takeover or Agent state changes are authorized. No personal identities, SSID, IP, bearer or refresh tokens are stored in GitHub or exported logs.

Known limitation: HTTP2 does not prove Firestore gRPC listener; SSE initial framing does not prove sustained heartbeat; no Firebase quota billing API is available unauthenticated; a real write→listen→ACK canary needs separate scoped authorization. Proposed later adaptive routing stays analysis-only until both network reports are compared.

Implementation PR: https://github.com/tamnv2/supra-inventory/pull/612. Diagnostic artifact is independent of Agent version and does not auto-install/update Agent, Android or Stable.

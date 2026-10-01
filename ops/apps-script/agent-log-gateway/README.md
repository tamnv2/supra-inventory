# D158 Beta Agent Log Gateway

Canonical planned Apps Script source for the Windows Agent support-log path.

Deployment is **Beta only** and must be executed as the Owner. Required Script Properties:

- `FIREBASE_WEB_API_KEY_BETA` — existing Beta Firebase Web API key; never commit the value.
- `BETA_LOG_FOLDER_ID` — exact scoped `Inventory/Beta/Logs` folder id from project authority.

Deploy as a Web App, execute as the Owner, access "Anyone" only because the endpoint performs its own Firebase ID-token + ADMIN/PICKPACK_ADMIN validation. Do not expose any token, password, WMS session or OAuth refresh material in source/logs.

After the Web App is deployed, store its `/exec` URL as GitHub Beta environment variable `AGENT_LOG_GATEWAY_URL_BETA` so CI can build the D158 Office field candidate against the gateway. This configuration is for field proof; it does **not** retire the D157 Firestore support-log fallback by itself. Firestore support-log retirement is allowed only after the real Office gateway/upload/idempotency checks PASS and the Owner accepts D158. If the variable is absent, Agent v93 retains the D157 Firestore support-log transport. Business Firestore/HA/PickList behavior is unrelated to this gateway.

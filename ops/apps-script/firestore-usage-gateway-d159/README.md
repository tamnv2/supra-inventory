# D159 Firestore Usage Gateway — Beta test only

This is an isolated Beta-only Google Apps Script used only by the standalone D159 Windows usage-test utility.

It is intentionally separate from the accepted D158 Agent log gateway and must not be added to the production Agent v94 runtime.

## Purpose

- Read selected `supra-inventory-beta` Firestore metrics from Google Cloud Monitoring.
- Cache the provider result for 15 minutes.
- Return a compact 24-hour/hourly snapshot to the D159 test EXE.
- Create **zero** Firestore document reads/writes/deletes for the monitoring feature itself.

Metrics:
- `firestore.googleapis.com/document/read_ops_count`
- `firestore.googleapis.com/document/write_ops_count`
- `firestore.googleapis.com/document/delete_ops_count`
- `firestore.googleapis.com/network/active_connections`
- `firestore.googleapis.com/network/snapshot_listeners`
- `firestore.googleapis.com/rules/evaluation_count`

## Security

Deploy as a Web App executing as the Owner. The URL may be publicly reachable, but every POST is rejected unless it contains a valid Firebase ID token whose `app_role` and `app_base_role` are the same and are either `ADMIN` or `PICKPACK_ADMIN`.

Required Script Property:

- `FIREBASE_WEB_API_KEY_BETA` — use the already-approved Beta Firebase Web API key value; never commit or log it.

No Google credential, OAuth refresh token, service-account material, Firebase ID token or password belongs in the repository or Apps Script logs.

## Deployment gate

Provisioning/deployment is Owner-only because the current connected tools cannot create a new Apps Script project or grant the Google consent screen.

After deployment, store the resulting `/exec` URL in the GitHub **beta environment variable**:

- `D159_USAGE_GATEWAY_URL_BETA`

The URL is injected only into the isolated D159 test EXE build. Do not reuse `AGENT_LOG_GATEWAY_URL_BETA`.

Stable is forbidden.

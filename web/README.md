# SUPRA Inventory Web — Beta

Beta-only Web client. Stable is intentionally untouched during the current test scope.

Authentication uses backend-authoritative username/password verification. The Worker returns a Firebase custom token; the client then opens a Firebase Auth session. This prevents arbitrary client-side account self-registration by MNV.

- API: `https://inventory-beta.supra.cc.cd`
- Firebase project: `supra-inventory-beta`
- Web App ID: `1:572322098890:web:96459cf386b3fb6f400e33`
- `VITE_FIREBASE_API_KEY` is injected as a public build configuration value.
- No password, token, private key or signing material is committed.

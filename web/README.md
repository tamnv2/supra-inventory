# SUPRA Inventory Web — Beta

Beta-only Web bootstrap. Stable is intentionally not configured or deployed during the current test scope.

## Runtime

- API: `https://inventory-beta.supra.cc.cd`
- Firebase project: `supra-inventory-beta`
- Firebase Web App ID: `1:572322098890:web:96459cf386b3fb6f400e33`
- Login surface accepts application username (for example `root` or MNV) and maps it to an internal synthetic Firebase email. The synthetic email is an implementation detail and is not shown to users.

`VITE_FIREBASE_API_KEY` is a public Firebase app configuration value but is intentionally injected at build time so the repo stays environment-neutral. No password/token is committed.

# SUPRA Inventory Android — Beta

Current scope is Beta only; Stable is intentionally untouched.

- Package: `cd.cc.supra.inventory.beta`
- Firebase project: `supra-inventory-beta`
- Firebase Android App ID: `1:572322098890:android:3e483937876cbcc0400e33`
- API: `https://inventory-beta.supra.cc.cd`
- AGP: 9.4.0 / JDK 17 / compileSdk 37
- Firebase Android BoM: 34.19.0

Login is `username/password → Worker → Firebase custom token → Firebase session`. The Firebase API key is injected through Gradle property `FIREBASE_API_KEY` or environment variable `FIREBASE_API_KEY_BETA`.

Foreground realtime uses an authenticated one-time ticket, then a WebSocket connection to `InventoryCore`. The socket carries invalidate signals only; business state is always re-read from the authoritative API. Picker/Reporter/Admin/Root workflows remain server-authoritative, and Stable is not affected.

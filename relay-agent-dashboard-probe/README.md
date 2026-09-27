# D127 Dashboard Probe

Purpose: diagnose the real Supra Dashboard activation path without changing normal Agent confirmation behavior.

## Run

1. Close only the visible **Trình duyệt Agent** window first. The Agent application itself may remain open.
2. Extract the whole probe ZIP.
3. Run `SUPRA.Dashboard.Probe.exe`.
4. The probe opens only `https://auth-supra.winmart.vn/dashboard`.
5. If Supra shows login, log in normally. The probe waits until Dashboard is loaded, then tests bounded activation methods against the exact right-arrow control.
6. If automatic methods do not transition, the status asks you to click the intended Dashboard arrow manually once.
7. Click **Mở thư mục log** and attach the newest `dashboard-probe-*.log` to the project chat.

## Safety

- Reuses the installed Agent WebView2 Fixed Runtime and dedicated profile only through WebView2.
- Does not read or copy browser profile files.
- Does not enable the DevTools Network domain.
- Does not read cookies, tokens, headers, web storage, password fields, or request payloads.
- Logged URLs are reduced to scheme + host + path; query strings and fragments are removed.
- Stable is not touched.

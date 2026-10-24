#!/usr/bin/env bash
# D173-E019: detach ONLY the registered compatibility custom-domain binding.
# NEVER mutate the Worker script, official host, SQLite, Firebase, DNS zone or D172.
set -euo pipefail
readonly OFFICIAL="inventory.supra.cc.cd"
readonly LEGACY="inventory-beta.supra.cc.cd"
readonly WORKER="supra-inventory-beta"
: "${CF_ACCOUNT_ID:?missing scoped Cloudflare account id}"
: "${CF_API_TOKEN:?missing scoped Cloudflare token}"
[[ "$CF_ACCOUNT_ID" =~ ^[[:xdigit:]]{32}$ ]] || { echo "::error::Invalid account scope"; exit 1; }
base="https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/domains"
before="$(mktemp)"; after="$(mktemp)"; response="$(mktemp)"; payload="$(mktemp)"
trap 'rm -f "$before" "$after" "$response" "$payload"' EXIT
list_domains() {
  local dest="$1" code
  code="$(curl -sS --max-time 25 -o "$dest" -w '%{http_code}' -H "Authorization: Bearer $CF_API_TOKEN" "$base?per_page=100")"
  [[ "$code" == 200 ]] && jq -e '.success == true and (.result | type) == "array"' "$dest" >/dev/null || {
    echo "::error::Cloudflare domains GET unavailable: stop"; return 1;
  }
}
list_domains "$before"
jq -e --arg o "$OFFICIAL" --arg w "$WORKER" '
  ([.result[] | select(.hostname == $o)] | length) == 1 and
  ([.result[] | select(.hostname == $o and .service == $w)] | length) == 1
' "$before" >/dev/null || { echo "::error::Official hostname ownership mismatch"; exit 1; }
jq -e --arg l "$LEGACY" --arg w "$WORKER" '
  ([.result[] | select(.hostname == $l)] | length) <= 1 and
  ([.result[] | select(.hostname == $l and .service != $w)] | length) == 0
' "$before" >/dev/null || { echo "::error::Unknown legacy hostname owner"; exit 1; }
old_id="$(jq -r --arg l "$LEGACY" '.result[] | select(.hostname == $l) | .id' "$before")"
old_zone="$(jq -r --arg l "$LEGACY" '.result[] | select(.hostname == $l) | .zone_id' "$before")"
official_zone="$(jq -r --arg o "$OFFICIAL" '.result[] | select(.hostname == $o) | .zone_id' "$before")"
if [[ -n "$old_id" && ( -z "$old_zone" || "$old_zone" != "$official_zone" ) ]]; then
  echo "::error::Registered zones are not identical"; exit 1
fi
if [[ "${D173_E019_APPLY:-no}" != "yes" ]]; then
  echo "D173_E019_CONTROL_PLANE_READONLY_PASS__OFFICIAL_SAME_WORKER__LEGACY_PRESENT=$([[ -n "$old_id" ]] && echo yes || echo no)"
  exit 0
fi
[[ "${GITHUB_EVENT_NAME:-}" == "push" && "${GITHUB_REF:-}" == "refs/heads/main" ]] || {
  echo "::error::Only a protected main push is permitted to detach"; exit 1;
}
[[ -n "$old_id" ]] || { echo "D173_E019_ALREADY_DETACHED__OFFICIAL_STILL_BOUND"; exit 0; }
# Confirm the official static page is reachable BEFORE change. Never invoke
# /health, which can exercise migrations/storage initialization.
http="$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "https://$OFFICIAL/about")"
[[ "$http" == "200" ]] || { echo "::error::Official host static asset unavailable"; exit 1; }
jq -n --arg hostname "$LEGACY" --arg zone_id "$old_zone" --arg service "$WORKER"   '{hostname:$hostname,zone_id:$zone_id,service:$service}' > "$payload"
rollback() {
  local code
  code="$(curl -sS --max-time 25 -X PUT -H "Authorization: Bearer $CF_API_TOKEN"     -H 'content-type: application/json' --data-binary "@$payload" -o "$response"     -w '%{http_code}' "$base" || true)"
  if [[ "$code" == "200" || "$code" == "201" ]]; then
    echo "::warning::D173_E019_ROLLBACK_PUT_ATTEMPTED__VERIFY_PROVIDER"
  else
    echo "::error::D173_E019_ROLLBACK_FAILED__MANUAL_REATTACH_REQUIRED"
  fi
}
http="$(curl -sS --max-time 25 -X DELETE -H "Authorization: Bearer $CF_API_TOKEN" -o "$response"   -w '%{http_code}' "$base/$old_id" || true)"
if [[ "$http" != "200" && "$http" != "204" ]]; then
  echo "::error::Cloudflare detach API failed; verify exact binding before retry"; exit 1
fi
if [[ "$http" == "200" ]] && ! jq -e '.success == true' "$response" >/dev/null; then
  echo "::error::Cloudflare detach response unsuccessful; inspect control-plane before retry"; exit 1
fi
for attempt in 1 2 3 4 5; do
  if list_domains "$after" && jq -e --arg o "$OFFICIAL" --arg l "$LEGACY" --arg w "$WORKER" '
    ([.result[] | select(.hostname == $o and .service == $w)] | length) == 1 and
    ([.result[] | select(.hostname == $l)] | length) == 0
  ' "$after" >/dev/null; then
    http="$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "https://$OFFICIAL/about" || true)"
    if [[ "$http" == "200" ]]; then
      echo "D173_E019_PROVIDER_DETACH_PASS__ONLY_LEGACY_HOST__OFFICIAL_WORKER_PRESERVED"
      exit 0
    fi
  fi
  sleep 2
done
echo "::error::Post-detach official mapping/access unverified; attempting exact same-Worker rollback"
rollback
exit 1

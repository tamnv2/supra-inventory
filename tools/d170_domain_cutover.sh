#!/usr/bin/env bash
# D170: reassign ONLY the registered official Custom Domain to the existing
# data-bearing Worker. No DNS deletion, Worker creation, secret logging, or DB copy.
set -euo pipefail
: "${CLOUDFLARE_API_TOKEN:?Missing scoped Cloudflare Worker token}"
: "${CLOUDFLARE_ACCOUNT_ID:?Missing registered Cloudflare account}"
[[ "${GITHUB_EVENT_NAME:-}" == "push" && "${GITHUB_REF:-}" == "refs/heads/main" ]] || {
  echo "::error::Domain reassignment is main-push release only"; exit 1;
}
[[ "$CLOUDFLARE_ACCOUNT_ID" =~ ^[[:xdigit:]]{32}$ ]] || exit 1
jq -e '.change_id == "D170" and
  .status == "OWNER_EXPLICIT_DEPLOY_APPROVED" and
  .code_scope == "D170_OFFICIAL_DOMAIN_SAME_WORKER_PHASE2" and
  .approved_components == ["worker"] and
  .domain_reassignment_permission == true and
  .existing_worker_and_durable_object_preserved == true and
  .stable_worker_deploy_permission == false' ops/d170-release-authorization.json >/dev/null || {
  echo "::error::D170 official domain cutover is not authorized"; exit 1;
}
grep -Fqx 'name = "supra-inventory-beta"' service/wrangler.beta.toml
grep -Fqx 'class_name = "InventoryCore"' service/wrangler.beta.toml
grep -Fqx 'pattern = "inventory-beta.supra.cc.cd"' service/wrangler.beta.toml
grep -Fqx 'pattern = "inventory.supra.cc.cd"' service/wrangler.beta.toml
grep -Fqx 'APP_ENV = "beta"' service/wrangler.beta.toml

account="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/domains"
before="$(mktemp)"
after="$(mktemp)"
output="$(mktemp)"
trap 'rm -f "$before" "$after" "$output"' EXIT
get_domains() {
  local target="$1" http
  http="$(curl --silent --show-error --max-time 25 -o "$target" -w '%{http_code}' \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "$account?per_page=100")"
  [[ "$http" == 200 ]] && jq -e '.success == true and (.result | type) == "array"' "$target" >/dev/null || {
    echo "::error::Cloudflare domain read failed HTTP $http"; exit 1;
  }
}
get_domains "$before"
# One exact record per hostname, same zone, old service never changed.
jq -e '([.result[] | select(.hostname == "inventory-beta.supra.cc.cd")] | length) == 1 and
       ([.result[] | select(.hostname == "inventory.supra.cc.cd")] | length) == 1' "$before" >/dev/null || {
  echo "::error::Expected registered custom domains are missing or ambiguous"; exit 1;
}
legacy="$(jq -r '.result[] | select(.hostname=="inventory-beta.supra.cc.cd") | .service' "$before")"
official="$(jq -r '.result[] | select(.hostname=="inventory.supra.cc.cd") | .service' "$before")"
oldzone="$(jq -r '.result[] | select(.hostname=="inventory-beta.supra.cc.cd") | .zone_id' "$before")"
newzone="$(jq -r '.result[] | select(.hostname=="inventory.supra.cc.cd") | .zone_id' "$before")"
[[ "$legacy" == "supra-inventory-beta" && "$oldzone" == "$newzone" && -n "$oldzone" && "$oldzone" != null ]] || {
  echo "::error::Existing authoritative Worker/zone mapping changed"; exit 1;
}
case "$official" in
  supra-inventory-beta)
    echo "D170 official hostname already mapped to data-bearing Worker";;
  supra-inventory-stable)
    # The stale Stable service is expressly NOT deployed. Only move the
    # existing hostname's routing to the existing Worker; do not delete it.
    body="$(jq -n --arg hostname inventory.supra.cc.cd \
      --arg service supra-inventory-beta --arg zone_id "$oldzone" \
      '{hostname:$hostname,service:$service,zone_id:$zone_id,enabled:true}')"
    status="$(curl --silent --show-error --max-time 35 -o "$output" -w '%{http_code}' \
      -X PUT -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H 'Content-Type: application/json' --data "$body" "$account")"
    [[ "$status" == 200 || "$status" == 201 ]] &&
      jq -e '.success == true and .result.hostname == "inventory.supra.cc.cd" and .result.service == "supra-inventory-beta"' "$output" >/dev/null || {
      echo "::error::Cloudflare did not confirm the official same-Worker binding (HTTP $status); no fallback deletion attempted";
      exit 1;
    }
    echo "D170 official hostname attached to the existing data-bearing Worker";;
  *)
    echo "::error::Official hostname belongs to unapproved service; no mutation attempted"; exit 1;;
esac
get_domains "$after"
jq -e '([.result[] | select(.hostname == "inventory-beta.supra.cc.cd" and .service == "supra-inventory-beta")] | length) == 1 and
       ([.result[] | select(.hostname == "inventory.supra.cc.cd" and .service == "supra-inventory-beta")] | length) == 1' "$after" >/dev/null || {
  echo "::error::Same-Worker dual-host mapping not confirmed"; exit 1;
}
echo "D170_DUAL_HOST_SAME_EXISTING_WORKER_CONTROL_PLANE_PASS"

#!/usr/bin/env bash
# D170: reassign ONLY the registered official Custom Domain to the existing
# data-bearing Worker. Only an explicitly scoped legacy Custom Domain binding
# may be detached on HTTP 409; never delete a Worker, database or DNS zone.
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
    # Cloudflare PUT returns HTTP 409 when this exact hostname is already
    # attached to another Worker. Transfer ONLY the registered Custom Domain
    # binding (not DNS zone, Worker, namespace, or business database).
    #
    # No delete happens unless the old binding is an exact registered
    # host+service+zone match and the D170 receipt authorizes this fallback.
    jq -e '.change_id == "D170" and
      .domain_reassignment_permission == true and
      .single_official_domain_detach_permission == true and
      .stable_worker_deploy_permission == false and
      .existing_worker_and_durable_object_preserved == true' ops/d170-release-authorization.json >/dev/null || {
      echo "::error::Owner authority does not permit moving legacy Stable domain binding"; exit 1;
    }
    existing_id="$(jq -r '.result[] | select(.hostname == "inventory.supra.cc.cd" and .service == "supra-inventory-stable") | .id' "$before")"
    [[ "$existing_id" =~ ^[[:alnum:]_-]{12,90}$ ]] || {
      echo "::error::Old official-domain binding identifier is invalid"; exit 1;
    }
    body="$(jq -n --arg hostname inventory.supra.cc.cd \
      --arg service supra-inventory-beta --arg zone_id "$oldzone" \
      '{hostname:$hostname,service:$service,zone_id:$zone_id,enabled:true}')"
    # First attempt the non-destructive reassignment. Only the expected
    # collision 409 allows detach+reattach, and only the exact old binding.
    status="$(curl --silent --show-error --max-time 35 -o "$output" -w '%{http_code}' \
      -X PUT -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H 'Content-Type: application/json' --data "$body" "$account")"
    if [[ "$status" == 200 || "$status" == 201 ]] &&
        jq -e '.success == true and .result.hostname == "inventory.supra.cc.cd" and .result.service == "supra-inventory-beta"' "$output" >/dev/null; then
      echo "D170 domain reassigned without detaching old binding"
    elif [[ "$status" == 409 ]]; then
      # Refresh authoritative state before touching the old binding. In a
      # concurrent move or changed zone/owner, fail without touching anything.
      get_domains "$after"
      jq -e --arg id "$existing_id" --arg zone "$oldzone" '
        ([.result[] | select(.hostname == "inventory-beta.supra.cc.cd" and .service == "supra-inventory-beta" and .zone_id == $zone)] | length) == 1 and
        ([.result[] | select(.hostname == "inventory.supra.cc.cd" and .service == "supra-inventory-stable" and .zone_id == $zone and .id == $id)] | length) == 1
      ' "$after" >/dev/null || {
        echo "::error::Official domain changed concurrently; never detach unexpected mapping"; exit 1;
      }
      echo "D170 verified 409 hostname conflict: transferring only the existing official Custom Domain binding"
      status="$(curl --silent --show-error --max-time 35 -o "$output" -w '%{http_code}' \
        -X DELETE -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        "$account/$existing_id")"
      if [[ "$status" != 200 && "$status" != 204 ]]; then
        echo "::error::Old Custom Domain binding detach was denied HTTP $status. No alternate deletion or data mutation."; exit 1;
      fi
      if [[ "$status" != 204 ]] && ! jq -e '.success == true' "$output" >/dev/null; then
        echo "::error::Cloudflare did not acknowledge old binding detach; fail closed"; exit 1;
      fi
      # A detach can briefly free the hostname before DNS reconciles. Reattach
      # with bounded retries. On failure, try to restore the ORIGINAL mapping.
      rebound=false
      for attempt in $(seq 1 12); do
        status="$(curl --silent --show-error --max-time 25 -o "$output" -w '%{http_code}' \
          -X PUT -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
          -H 'Content-Type: application/json' --data "$body" "$account" || true)"
        if [[ "$status" == 200 || "$status" == 201 ]] &&
          jq -e '.success == true and .result.hostname == "inventory.supra.cc.cd" and .result.service == "supra-inventory-beta"' "$output" >/dev/null; then
          rebound=true
          break
        fi
        sleep 5
      done
      if [[ "$rebound" != true ]]; then
        # Inspect the final owner; do not overwrite a different owner's move.
        get_domains "$after"
        current="$(jq -r '[.result[] | select(.hostname == "inventory.supra.cc.cd") | .service] | unique | join(",")' "$after")"
        if [[ -z "$current" ]]; then
          rollback="$(jq -n --arg hostname inventory.supra.cc.cd \
            --arg service supra-inventory-stable --arg zone_id "$oldzone" \
            '{hostname:$hostname,service:$service,zone_id:$zone_id,enabled:true}')"
          rollback_code="$(curl --silent --show-error --max-time 30 -o "$output" -w '%{http_code}' \
            -X PUT -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H 'Content-Type: application/json' --data "$rollback" "$account" || true)"
          if [[ "$rollback_code" == 200 || "$rollback_code" == 201 ]]; then
            echo "::warning::D170 new binding failed; restored pre-existing Stable hostname mapping"
          else
            echo "::error::D170 new binding failed, automatic restoration also failed. Owner must restore ONLY the Custom Domain."
          fi
        else
          echo "::error::D170 official hostname unexpectedly assigned to another Worker. No rollback over concurrent owner."
        fi
        exit 1
      fi
      echo "D170 official Custom Domain binding moved; old Worker and data were NOT deleted"
    else
      echo "::error::Cloudflare refused official domain reassignment HTTP $status; old mapping untouched"; exit 1;
    fi;;
  *)
    echo "::error::Official hostname belongs to unapproved service; no mutation attempted"; exit 1;;
esac
get_domains "$after"
jq -e '([.result[] | select(.hostname == "inventory-beta.supra.cc.cd" and .service == "supra-inventory-beta")] | length) == 1 and
       ([.result[] | select(.hostname == "inventory.supra.cc.cd" and .service == "supra-inventory-beta")] | length) == 1' "$after" >/dev/null || {
  echo "::error::Same-Worker dual-host mapping not confirmed"; exit 1;
}
echo "D170_DUAL_HOST_SAME_EXISTING_WORKER_CONTROL_PLANE_PASS"

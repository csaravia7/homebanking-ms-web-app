#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  HomeBanking — Validate OTel Pipeline (services → Collector → Dynatrace)
#
#  Checks, per microservice:
#    1. Pod running/ready
#    2. OTel Operator injected the right agent/SDK (init container)
#    3. OTEL_* env vars actually present in the container
#  Then, for the Collector:
#    4. Deployment healthy
#    5. Config has an otlp receiver + a Dynatrace exporter wired to traces/metrics/logs
#    6. (optional, default on) Temporarily adds a `debug` exporter, generates traffic
#       via a short-lived curl pod, and greps the Collector's own stdout to confirm
#       each service's signals are actually reaching it — then reverts the config.
#    7. Scans recent Collector logs for export errors towards Dynatrace
#       (401/403/timeout/TLS) that would explain "data reaches the collector but
#       never shows up in Dynatrace".
#
#  Usage:
#    ./scripts/validate-otel-pipeline.sh                   # full validation
#    ./scripts/validate-otel-pipeline.sh --skip-debug       # static checks only (fast, no restarts)
#    ./scripts/validate-otel-pipeline.sh --service auth-service
#    NAMESPACE=other-ns ./scripts/validate-otel-pipeline.sh
#
#  Requires: kubectl (configured against the target cluster), jq
#  Compatible with bash 3.2 (macOS default) — no associative arrays.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

NAMESPACE="${NAMESPACE:-homebanking}"
CM_NAME="otel-collector-config"
COLLECTOR_DEPLOY="otel-collector"
TAIL_SECONDS="${TAIL_SECONDS:-35}"
SKIP_DEBUG=false
ONLY_SERVICE=""

# ── Args ──────────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-debug) SKIP_DEBUG=true; shift ;;
    --service) ONLY_SERVICE="$2"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^#//'; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# "service:language:port:health-path" — plain array, bash 3.2 compatible (no declare -A)
SERVICE_INFO=(
  "auth-service:java:3001:/health"
  "account-service:python:3003:/health"
  "transaction-service:java:3004:/transactions/health"
  "notification-service:python:3005:/health"
  "api-gateway:java:8080:/health"
)

if [[ -n "$ONLY_SERVICE" ]]; then
  match=""
  for entry in "${SERVICE_INFO[@]}"; do
    [[ "${entry%%:*}" == "$ONLY_SERVICE" ]] && match="$entry"
  done
  [[ -n "$match" ]] || { echo "Unknown service: $ONLY_SERVICE" >&2; exit 1; }
  SERVICE_INFO=("$match")
fi

# ── Colors / helpers (same style as the other scripts/*.sh) ──────────────────
GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓  $1${NC}"; }
info() { echo -e "${CYAN}▶  $1${NC}"; }
warn() { echo -e "${YELLOW}⚠  $1${NC}"; }
fail() { echo -e "${RED}✗  $1${NC}" >&2; }

command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found" >&2; exit 1; }
command -v jq      >/dev/null 2>&1 || { echo "jq not found (brew install jq)" >&2; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  OTel Pipeline Validation — namespace: ${NAMESPACE}$(printf '%*s' $((14>${#NAMESPACE}?14-${#NAMESPACE}:0)) '')║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

kubectl get ns "$NAMESPACE" >/dev/null 2>&1 || { fail "Namespace '$NAMESPACE' not found — check your kubeconfig/context"; exit 1; }
ok "Connected to cluster, namespace '$NAMESPACE' exists"

# ── 1-3. Per-service static checks ────────────────────────────────────────────
for entry in "${SERVICE_INFO[@]}"; do
  svc="${entry%%:*}"; rest="${entry#*:}"
  lang="${rest%%:*}"

  echo ""
  info "Checking $svc (expected instrumentation: $lang)"

  pod=$(kubectl get pod -n "$NAMESPACE" -l app="$svc" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  if [[ -z "$pod" ]]; then
    fail "  no pod found for app=$svc"
    continue
  fi

  ready=$(kubectl get pod -n "$NAMESPACE" "$pod" -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null || echo false)
  if [[ "$ready" == "true" ]]; then
    ok "  pod $pod is Ready"
  else
    fail "  pod $pod is NOT Ready"
  fi

  init_containers=$(kubectl get pod -n "$NAMESPACE" "$pod" -o jsonpath='{.spec.initContainers[*].name}' 2>/dev/null || true)
  if echo "$init_containers" | grep -qi "opentelemetry-auto-instrumentation-$lang"; then
    ok "  OTel Operator injected the $lang agent/SDK (init container: $init_containers)"
  else
    fail "  expected init container 'opentelemetry-auto-instrumentation-$lang' NOT found (got: '${init_containers:-none}')"
  fi

  env_out=$(kubectl exec -n "$NAMESPACE" "$pod" -- env 2>/dev/null | grep '^OTEL_' || true)
  if [[ -n "$env_out" ]]; then
    ok "  OTEL_* env vars present:"
    echo "$env_out" | sed 's/^/      /'
  else
    fail "  no OTEL_* env vars found inside the container"
  fi
done

# ── 4-5. Collector health + config sanity ─────────────────────────────────────
echo ""
info "Checking otel-collector deployment"
collector_ready=$(kubectl get deployment -n "$NAMESPACE" "$COLLECTOR_DEPLOY" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0)
if [[ "${collector_ready:-0}" -ge 1 ]]; then
  ok "otel-collector has $collector_ready ready replica(s)"
else
  fail "otel-collector has no ready replicas — nothing downstream will work"
fi

CM_KEY=$(kubectl get configmap -n "$NAMESPACE" "$CM_NAME" -o json | jq -r '.data | keys[0]')
cm_data=$(kubectl get configmap -n "$NAMESPACE" "$CM_NAME" -o json | jq -r --arg k "$CM_KEY" '.data[$k]')

# Find the Dynatrace exporter by its actual target endpoint (*.live.dynatrace.com),
# not by assuming a naming convention like "otlphttp/dynatrace" — the component can
# legally be named anything (e.g. "otlphttp/dt"). Scoped strictly to the top-level
# "exporters:" block (via indentation tracking) so an unrelated "annotations:" or
# similar key elsewhere in the file (e.g. inside the k8sattributes processor) can
# never be picked up as a stale candidate.
DT_EXPORTER=$(echo "$cm_data" | awk '
  /^[[:space:]]*exporters:[[:space:]]*$/ && !in_exp {
    match($0, /^[[:space:]]*/); base = RLENGTH; in_exp = 1; next
  }
  in_exp {
    match($0, /^[[:space:]]*/); ind = RLENGTH
    if (ind <= base && $0 ~ /[a-zA-Z]/) { in_exp = 0; next }
    if ($0 ~ /^[[:space:]]+[a-zA-Z0-9_.\/-]+:/) {
      candidate = $0
      sub(/^[[:space:]]+/, "", candidate)
      sub(/:.*/, "", candidate)
    }
    if ($0 ~ /dynatrace\.com/) { print candidate; exit }
  }
')
config_ok=true
if [[ -z "$DT_EXPORTER" ]]; then
  fail "Could not find an exporter pointing at *.live.dynatrace.com in $CM_NAME"
  config_ok=false
elif ! echo "$cm_data" | grep -qE "receivers:[[:space:]]*\[[^]]*otlp[^]]*\]"; then
  fail "Collector config has a Dynatrace exporter ('$DT_EXPORTER') but no pipeline references an otlp receiver"
  config_ok=false
else
  ok "Collector config has an otlp receiver and a Dynatrace exporter ('$DT_EXPORTER')"
fi

if [[ "$config_ok" == "false" ]]; then
  warn "  Diagnostic dump — ConfigMap key: '$CM_KEY'. Full exporters + pipelines blocks:"
  echo "$cm_data" | awk '/^[[:space:]]*(exporters|service):[[:space:]]*$/{f=1} f' | sed 's/^/      /'
fi

for pipeline in traces metrics logs; do
  pipeline_exporters=$(echo "$cm_data" | awk "/^[[:space:]]*${pipeline}:[[:space:]]*\$/{f=1} f && /exporters:/{print; exit}")
  if [[ -n "$DT_EXPORTER" ]] && echo "$pipeline_exporters" | grep -qF "$DT_EXPORTER"; then
    ok "  pipeline '$pipeline' exports to $DT_EXPORTER"
  else
    fail "  pipeline '$pipeline' does NOT export to ${DT_EXPORTER:-<no dynatrace exporter found>} (got: '${pipeline_exporters:-none found}')"
  fi
done

# ── 7. Scan recent collector logs for export errors to Dynatrace ─────────────
echo ""
info "Scanning recent collector logs for export errors (auth/TLS/timeout)"
recent_logs=$(kubectl logs -n "$NAMESPACE" deploy/"$COLLECTOR_DEPLOY" --tail=500 2>/dev/null || true)
error_hits=$(echo "$recent_logs" | grep -iE "401|403|unauthorized|invalid api.?token|x509|certificate|context deadline exceeded|connection refused|exporterhelper.*error" || true)
if [[ -n "$error_hits" ]]; then
  fail "Found error-looking lines in collector logs (may indicate a bad DYNATRACE_API_TOKEN / DYNATRACE_ENVIRONMENT_ID or network issue):"
  echo "$error_hits" | tail -20 | sed 's/^/      /'
else
  ok "No obvious export errors in the last 500 log lines"
fi

# ── 6. Dynamic validation: temporary debug exporter ───────────────────────────
if [[ "$SKIP_DEBUG" == "true" ]]; then
  warn "Skipping dynamic signal validation (--skip-debug). Static checks only."
  echo ""
  echo -e "${CYAN}Done.${NC} For a definitive answer, re-run without --skip-debug, or check Dynatrace directly."
  exit 0
fi

echo ""
warn "About to temporarily patch '$CM_NAME' to add a debug exporter and restart the collector."
warn "This causes a brief (~10-20s) gap in telemetry collection. Original config is restored automatically."
read -r -p "Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  warn "Aborted by user. Static checks above are still valid."
  exit 0
fi

BACKUP_FILE="$(mktemp -t otel-collector-config-backup.XXXXXX).yaml"
kubectl get configmap -n "$NAMESPACE" "$CM_NAME" -o yaml > "$BACKUP_FILE"
info "Backed up current config to $BACKUP_FILE"

restore_config() {
  info "Restoring original collector config..."
  kubectl apply -f "$BACKUP_FILE" >/dev/null 2>&1 || fail "Could not restore config automatically — apply $BACKUP_FILE manually!"
  kubectl rollout restart deployment "$COLLECTOR_DEPLOY" -n "$NAMESPACE" >/dev/null 2>&1 || true
  kubectl rollout status deployment "$COLLECTOR_DEPLOY" -n "$NAMESPACE" --timeout=120s >/dev/null 2>&1 || true
}
trap restore_config EXIT

# Add a `debug` exporter and wire it into every pipeline — pure sed/jq, no python/pyyaml dependency.
# Wiring matches ANY flow-style "exporters: [x, y]" pipeline line regardless of the exporter
# names inside (so it works whatever the Dynatrace exporter is actually called), and only the
# top-level block-style "exporters:" (no brackets) gets the new "debug:" component definition.
# Safe to re-run: skips re-adding "debug:" if already present, and won't double-append ", debug".
if echo "$cm_data" | grep -qE '^[[:space:]]*debug:[[:space:]]*$'; then
  patched_cfg="$cm_data"
else
  patched_cfg=$(printf '%s\n' "$cm_data" | sed '/^[[:space:]]*exporters:[[:space:]]*$/a\
      debug:\
        verbosity: detailed
')
fi
patched_cfg=$(printf '%s\n' "$patched_cfg" | sed -E 's/(exporters:[[:space:]]*\[[^]]*)\]/\1, debug]/g; s/, debug, debug\]/, debug]/g')

kubectl get configmap -n "$NAMESPACE" "$CM_NAME" -o json \
  | jq --arg k "$CM_KEY" --arg v "$patched_cfg" '.data[$k] = $v' \
  | kubectl apply -f - >/dev/null

info "Debug exporter added, restarting collector..."
kubectl rollout restart deployment "$COLLECTOR_DEPLOY" -n "$NAMESPACE" >/dev/null
kubectl rollout status deployment "$COLLECTOR_DEPLOY" -n "$NAMESPACE" --timeout=120s

# Generate traffic against every service from inside the cluster (app images are
# alpine/slim and may not have curl, so use a dedicated curl pod). /health alone is
# NOT enough to validate the logs pipeline — none of the /health handlers log
# anything by design — so each service also gets one call to an endpoint that is
# known to emit a log line (a deliberately-invalid request is enough; no state is
# mutated). This does not require any of the OTHER services to be reachable.
LOG_TRIGGER_auth_service='curl -s -X POST http://auth-service:3001/verify -H "Authorization: Bearer invalid.token.here" >/dev/null 2>&1'
LOG_TRIGGER_account_service='curl -s http://account-service:3003/api/accounts -H "Authorization: Bearer a.b.c" >/dev/null 2>&1'
LOG_TRIGGER_transaction_service='curl -s -X POST http://transaction-service:3004/transactions -H "Content-Type: application/json" -d "{}" >/dev/null 2>&1'
LOG_TRIGGER_notification_service='curl -s http://notification-service:3005/notifications -H "Authorization: Bearer a.b.c" >/dev/null 2>&1'
LOG_TRIGGER_api_gateway='curl -s -X POST http://api-gateway:8080/api/auth/login -H "Content-Type: application/json" -d "not-json" >/dev/null 2>&1'

info "Generating traffic (health + a log-triggering call per service) via a short-lived curl pod for ${TAIL_SECONDS}s..."
TRAFFIC_CMDS=""
for entry in "${SERVICE_INFO[@]}"; do
  svc="${entry%%:*}"; rest="${entry#*:}"; rest="${rest#*:}"
  port="${rest%%:*}"; path="${rest#*:}"
  var_name="LOG_TRIGGER_${svc//-/_}"
  TRAFFIC_CMDS="${TRAFFIC_CMDS} curl -sf http://${svc}:${port}${path} >/dev/null 2>&1; ${!var_name};"
done
kubectl run otel-validate-traffic --rm -i --restart=Never --quiet \
  --image=curlimages/curl -n "$NAMESPACE" -- \
  sh -c "END=\$(( \$(date +%s) + ${TAIL_SECONDS} )); while [ \$(date +%s) -lt \$END ]; do ${TRAFFIC_CMDS} sleep 2; done" \
  >/dev/null 2>&1 &
TRAFFIC_PID=$!

CAPTURE_FILE="$(mktemp -t otel-debug-capture.XXXXXX).log"
timeout "$((TAIL_SECONDS + 5))" kubectl logs -n "$NAMESPACE" deploy/"$COLLECTOR_DEPLOY" -f > "$CAPTURE_FILE" 2>&1 || true
wait "$TRAFFIC_PID" 2>/dev/null || true

# ── Attribute observed signals per service ────────────────────────────────────
echo ""
echo -e "${CYAN}Signal detection (heuristic smoke test — verify in Dynatrace for certainty):${NC}"
printf "%-24s %-10s %-10s %-10s\n" "SERVICE" "TRACES" "METRICS" "LOGS"

signal_seen() {
  # $1=file $2=Resource block type (Spans|Metrics|Logs) $3=service name
  awk -v marker="Resource$2" -v svc="$3" '
    /^Resource(Spans|Metrics|Logs) #/ { in_block = ($0 ~ marker) }
    in_block && index($0, "service.name: Str(" svc ")") { found=1 }
    END { exit !found }
  ' "$1"
}

for entry in "${SERVICE_INFO[@]}"; do
  svc="${entry%%:*}"
  t="no"; m="no"; l="no"
  signal_seen "$CAPTURE_FILE" "Spans"   "$svc" && t="yes"
  signal_seen "$CAPTURE_FILE" "Metrics" "$svc" && m="yes"
  signal_seen "$CAPTURE_FILE" "Logs"    "$svc" && l="yes"
  printf "%-24s %-10s %-10s %-10s\n" "$svc" "$t" "$m" "$l"
done

echo ""
info "Full captured collector output kept at: $CAPTURE_FILE"
info "Manual cross-check if needed: grep -A5 'service.name: Str(<service>)' $CAPTURE_FILE"

# restore_config() runs automatically via the EXIT trap
echo ""
echo -e "${GREEN}Validation complete.${NC} Collector config has been restored to its original state."

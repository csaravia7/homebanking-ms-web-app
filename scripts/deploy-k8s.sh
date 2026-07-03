#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  HomeBanking — Deploy to AKS
#
#  Prerequisites:
#    - az login  (Azure CLI authenticated)
#    - kubectl configured: az aks get-credentials --resource-group <rg> --name <cluster>
#    - Images already pushed: ./scripts/build.sh
#    - envsubst available: brew install gettext && brew link --force gettext
#
#  Usage:
#    export DOCKER_REGISTRY=myusername
#    export IMAGE_TAG=latest           # optional
#    ./scripts/deploy-k8s.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOCKER_REGISTRY="${DOCKER_REGISTRY:-}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
MANIFESTS_DIR="$(cd "$(dirname "$0")/../k8s-aks" && pwd)"
NAMESPACE="homebanking"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓  $1${NC}"; }
info() { echo -e "${CYAN}▶  $1${NC}"; }
fail() { echo -e "${RED}✗  $1${NC}" >&2; exit 1; }

[[ -z "$DOCKER_REGISTRY" ]] && fail "DOCKER_REGISTRY is not set. Export your Docker Hub username."
command -v kubectl  >/dev/null 2>&1 || fail "kubectl not found"
command -v envsubst >/dev/null 2>&1 || fail "envsubst not found (brew install gettext)"

export DOCKER_REGISTRY IMAGE_TAG

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  HomeBanking — AKS Deployment                        ║${NC}"
echo -e "${CYAN}║  Registry : ${DOCKER_REGISTRY}$(printf '%*s' $((37-${#DOCKER_REGISTRY})) '')║${NC}"
echo -e "${CYAN}║  Tag      : ${IMAGE_TAG}$(printf '%*s' $((37-${#IMAGE_TAG})) '')║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Apply manifests in order ──────────────────────────────────────────────────
for manifest in "$MANIFESTS_DIR"/*.yaml; do
  filename="$(basename "$manifest")"
  info "Applying $filename ..."
  envsubst '${DOCKER_REGISTRY} ${IMAGE_TAG}' < "$manifest" | kubectl apply -f -
  ok "$filename applied"
done

# ── Wait for rollouts ─────────────────────────────────────────────────────────
echo ""
info "Waiting for deployments to become ready..."

DEPLOYMENTS=(
  postgres             # StatefulSet — not a Deployment but kubectl rollout works
  auth-service
  account-service
  transaction-service
  notification-service
  api-gateway
  web-frontend
)

for dep in "${DEPLOYMENTS[@]}"; do
  info "Rolling out $dep ..."
  kubectl rollout status deployment/"$dep" -n "$NAMESPACE" --timeout=180s 2>/dev/null || \
  kubectl rollout status statefulset/"$dep" -n "$NAMESPACE" --timeout=180s 2>/dev/null || \
    echo "  (skipped – may still be initialising)"
done

# ── Print access info ─────────────────────────────────────────────────────────
echo ""
ok "Deployment complete!"
echo ""
echo "Get the public IP of the ingress controller:"
echo "  kubectl get svc -n ingress-nginx ingress-nginx-controller"
echo ""
echo "Pod status:"
kubectl get pods -n "$NAMESPACE"

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

GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓  $1${NC}"; }
info() { echo -e "${CYAN}▶  $1${NC}"; }
warn() { echo -e "${YELLOW}⚠  $1${NC}"; }
fail() { echo -e "${RED}✗  $1${NC}" >&2; exit 1; }

[[ -z "$DOCKER_REGISTRY" ]] && fail "DOCKER_REGISTRY is not set. Export tu usuario de Docker Hub."
command -v kubectl  >/dev/null 2>&1 || fail "kubectl no encontrado"
command -v envsubst >/dev/null 2>&1 || fail "envsubst no encontrado (brew install gettext)"

export DOCKER_REGISTRY IMAGE_TAG DYNATRACE_ENVIRONMENT_ID DYNATRACE_API_TOKEN

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  HomeBanking — AKS Deployment                        ║${NC}"
echo -e "${CYAN}║  Registry : ${DOCKER_REGISTRY}$(printf '%*s' $((37-${#DOCKER_REGISTRY})) '')║${NC}"
echo -e "${CYAN}║  Tag      : ${IMAGE_TAG}$(printf '%*s' $((37-${#IMAGE_TAG})) '')║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Credenciales Dynatrace ─────────────────────────────────────────────────────
info "Configurando credenciales de Dynatrace..."

# Usar variables de entorno si ya están definidas, si no, pedir al usuario
if [[ -z "${DYNATRACE_ENVIRONMENT_ID:-}" ]]; then
  read -rp "  Dynatrace Environment ID (ej: abc12345): " DYNATRACE_ENVIRONMENT_ID
fi
if [[ -z "${DYNATRACE_API_TOKEN:-}" ]]; then
  read -rsp "  Dynatrace API Token (dt0c01.XXX): " DYNATRACE_API_TOKEN
  echo ""
fi

[[ -z "$DYNATRACE_ENVIRONMENT_ID" ]] && fail "DYNATRACE_ENVIRONMENT_ID no puede estar vacío"
[[ -z "$DYNATRACE_API_TOKEN"     ]] && fail "DYNATRACE_API_TOKEN no puede estar vacío"

# Crear namespace primero (necesario antes de crear el secret)
kubectl apply -f "$MANIFESTS_DIR/00-namespace.yaml"

# Crear/actualizar el secret de Dynatrace (--dry-run + apply para ser idempotente)
kubectl -n "$NAMESPACE" create secret generic dynatrace-credentials \
  --from-literal=DYNATRACE_ENVIRONMENT_ID="$DYNATRACE_ENVIRONMENT_ID" \
  --from-literal=DYNATRACE_API_TOKEN="$DYNATRACE_API_TOKEN" \
  --save-config \
  --dry-run=client -o yaml | kubectl apply -f -

ok "Secret dynatrace-credentials creado/actualizado"
echo ""

# ── OTel Operator (prerequisito para auto-instrumentación) ────────────────────
info "Verificando OTel Operator..."

# 1. cert-manager (requerido por el Operator)
if ! kubectl get namespace cert-manager >/dev/null 2>&1; then
  info "Instalando cert-manager..."
  kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
  info "Esperando que cert-manager esté listo..."
  kubectl wait --for=condition=Available deployment -n cert-manager --all --timeout=120s
  ok "cert-manager listo"
else
  ok "cert-manager ya instalado"
fi

# 2. OTel Operator
if ! kubectl get deployment opentelemetry-operator-controller-manager -n opentelemetry-operator >/dev/null 2>&1; then
  info "Instalando OTel Operator..."
  helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts 2>/dev/null || true
  helm repo update open-telemetry
  helm upgrade --install opentelemetry-operator \
    open-telemetry/opentelemetry-operator \
    --namespace opentelemetry-operator --create-namespace \
    --set admissionWebhooks.certManager.enabled=true \
    --wait --timeout=180s
  ok "OTel Operator instalado"
else
  ok "OTel Operator ya instalado"
fi
echo ""

# ── Aplicar manifests en orden ────────────────────────────────────────────────
# IMPORTANTE: aplicar el Instrumentation CRD ANTES que los Deployments de
# los servicios para que el Operator pueda inyectar el SDK al crear los pods.

info "Aplicando infraestructura base (namespace, secrets, configmaps)..."
for manifest in "$MANIFESTS_DIR"/0[0-4]-*.yaml; do
  filename="$(basename "$manifest")"
  [[ "$filename" == "00-namespace.yaml" ]] && { ok "$filename (ya aplicado)"; continue; }
  info "Aplicando $filename ..."
  envsubst '${DOCKER_REGISTRY} ${IMAGE_TAG} ${DYNATRACE_ENVIRONMENT_ID} ${DYNATRACE_API_TOKEN}' < "$manifest" | kubectl apply -f -
  ok "$filename aplicado"
done

info "Aplicando OTel Collector e Instrumentation CRD (antes de los servicios)..."
for manifest in "$MANIFESTS_DIR"/1[2-3]-*.yaml; do
  filename="$(basename "$manifest")"
  info "Aplicando $filename ..."
  envsubst '${DOCKER_REGISTRY} ${IMAGE_TAG} ${DYNATRACE_ENVIRONMENT_ID} ${DYNATRACE_API_TOKEN}' < "$manifest" | kubectl apply -f -
  ok "$filename aplicado"
done

info "Aplicando servicios (el Operator inyectará el SDK automáticamente)..."
for manifest in "$MANIFESTS_DIR"/0[5-9]-*.yaml "$MANIFESTS_DIR"/1[01]-*.yaml; do
  [[ -f "$manifest" ]] || continue
  filename="$(basename "$manifest")"
  info "Aplicando $filename ..."
  envsubst '${DOCKER_REGISTRY} ${IMAGE_TAG} ${DYNATRACE_ENVIRONMENT_ID} ${DYNATRACE_API_TOKEN}' < "$manifest" | kubectl apply -f -
  ok "$filename aplicado"
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

# ── Restart para garantizar inyección del OTel SDK ────────────────────────────
echo ""
info "Reiniciando deployments para activar inyección del OTel Operator..."
kubectl rollout restart deployment/auth-service \
                         deployment/account-service \
                         deployment/transaction-service \
                         deployment/notification-service \
                         deployment/api-gateway \
                         -n "$NAMESPACE" 2>/dev/null || true
ok "Restart solicitado — el Operator inyectará el SDK en los nuevos pods"

# ── Obtener IPs públicas ──────────────────────────────────────────────────────
echo ""
info "Esperando IPs públicas de LoadBalancer (puede tardar ~60s)..."

for svc in web-frontend api-gateway; do
  for i in $(seq 1 24); do
    EXTERNAL_IP=$(kubectl get svc "$svc" -n "$NAMESPACE" \
      -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)
    [[ -n "$EXTERNAL_IP" ]] && break
    printf "."
    sleep 5
  done
  echo ""
  if [[ -n "$EXTERNAL_IP" ]]; then
    ok "$svc → http://$EXTERNAL_IP"
  else
    warn "$svc: IP pública aún pendiente. Consulta: kubectl get svc $svc -n $NAMESPACE"
  fi
done

echo ""
ok "Deployment complete!"
echo ""
echo "Pod status:"
kubectl get pods -n "$NAMESPACE"

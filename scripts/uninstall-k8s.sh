#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  HomeBanking — Desinstalación completa de AKS
#
#  Uso:
#    ./scripts/uninstall-k8s.sh              # elimina namespace y recursos
#    DELETE_PVC=true ./scripts/uninstall-k8s.sh   # también borra datos PostgreSQL
#    DELETE_INGRESS=true ./scripts/uninstall-k8s.sh  # también borra ingress-nginx
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

NAMESPACE="homebanking"
DELETE_PVC="${DELETE_PVC:-false}"
DELETE_INGRESS="${DELETE_INGRESS:-false}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓  $1${NC}"; }
info() { echo -e "${CYAN}▶  $1${NC}"; }
warn() { echo -e "${YELLOW}⚠  $1${NC}"; }
fail() { echo -e "${RED}✗  $1${NC}" >&2; exit 1; }

command -v kubectl >/dev/null 2>&1 || fail "kubectl no encontrado"

echo ""
echo -e "${RED}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║  HomeBanking — Desinstalación de AKS                 ║${NC}"
echo -e "${RED}║  Namespace : ${NAMESPACE}$(printf '%*s' $((39-${#NAMESPACE})) '')║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Confirmar antes de proceder ───────────────────────────────────────────────
warn "Esta operación eliminará TODOS los recursos del namespace '${NAMESPACE}'."
[[ "$DELETE_PVC"    == "true" ]] && warn "DELETE_PVC=true  → los datos de PostgreSQL serán BORRADOS permanentemente."
[[ "$DELETE_INGRESS" == "true" ]] && warn "DELETE_INGRESS=true → el ingress-nginx controller será eliminado."
echo ""
read -rp "¿Confirmar desinstalación? (escribe 'si' para continuar): " CONFIRM
[[ "$CONFIRM" != "si" ]] && { echo "Operación cancelada."; exit 0; }
echo ""

# ── 1. Scale down todos los deployments primero (graceful shutdown) ───────────
info "Escalando a 0 todos los deployments..."
kubectl scale deployment --all -n "$NAMESPACE" --replicas=0 2>/dev/null && ok "Deployments escalados a 0" || warn "No se encontraron deployments"

# ── 2. Eliminar HPAs ──────────────────────────────────────────────────────────
info "Eliminando HorizontalPodAutoscalers..."
kubectl delete hpa --all -n "$NAMESPACE" --ignore-not-found=true
ok "HPAs eliminados"

# ── 3. Eliminar Ingress ───────────────────────────────────────────────────────
info "Eliminando Ingress..."
kubectl delete ingress --all -n "$NAMESPACE" --ignore-not-found=true
ok "Ingress eliminado"

# ── 4. Eliminar Deployments y StatefulSets ────────────────────────────────────
info "Eliminando Deployments..."
kubectl delete deployment --all -n "$NAMESPACE" --ignore-not-found=true
ok "Deployments eliminados"

info "Eliminando StatefulSets..."
kubectl delete statefulset --all -n "$NAMESPACE" --ignore-not-found=true
ok "StatefulSets eliminados"

# ── 5. Eliminar Services ──────────────────────────────────────────────────────
info "Eliminando Services..."
kubectl delete service --all -n "$NAMESPACE" --ignore-not-found=true
ok "Services eliminados"

# ── 6. Eliminar ConfigMaps y Secrets ─────────────────────────────────────────
info "Eliminando ConfigMaps..."
kubectl delete configmap --all -n "$NAMESPACE" --ignore-not-found=true
ok "ConfigMaps eliminados"

info "Eliminando Secrets..."
kubectl delete secret --all -n "$NAMESPACE" --ignore-not-found=true
ok "Secrets eliminados"

# ── 7. PVCs (opcional — datos de PostgreSQL) ──────────────────────────────────
if [[ "$DELETE_PVC" == "true" ]]; then
  warn "Eliminando PersistentVolumeClaims (datos de BD serán borrados)..."
  kubectl delete pvc --all -n "$NAMESPACE" --ignore-not-found=true
  ok "PVCs eliminados"
else
  warn "PVCs conservados (usa DELETE_PVC=true para eliminarlos junto con los datos)"
  kubectl get pvc -n "$NAMESPACE" 2>/dev/null || true
fi

# ── 8. Eliminar el namespace completo ────────────────────────────────────────
info "Eliminando namespace '${NAMESPACE}'..."
kubectl delete namespace "$NAMESPACE" --ignore-not-found=true
ok "Namespace '${NAMESPACE}' eliminado"

# ── 9. Ingress controller (opcional) ─────────────────────────────────────────
if [[ "$DELETE_INGRESS" == "true" ]]; then
  warn "Eliminando ingress-nginx controller..."
  helm uninstall ingress-nginx -n ingress-nginx 2>/dev/null && ok "ingress-nginx eliminado" || warn "ingress-nginx no encontrado (ya eliminado o no instalado con Helm)"
  kubectl delete namespace ingress-nginx --ignore-not-found=true
fi

# ── Resumen ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Desinstalación completada                           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Recursos K8s eliminados del namespace: ${NAMESPACE}"
[[ "$DELETE_PVC"     == "true" ]] && echo "  Datos de PostgreSQL: ELIMINADOS"    || echo "  Datos de PostgreSQL: conservados (PVCs intactos)"
[[ "$DELETE_INGRESS" == "true" ]] && echo "  Ingress controller:   ELIMINADO"    || echo "  Ingress controller:   conservado"
echo ""
echo "Para redesplegar:"
echo "  export DOCKER_REGISTRY=<registry> IMAGE_TAG=<tag>"
echo "  ./scripts/deploy-k8s.sh"
echo ""

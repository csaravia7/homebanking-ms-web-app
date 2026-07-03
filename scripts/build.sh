#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  HomeBanking Microservices — Docker Build & Push to Docker Hub
#
#  Usage:
#    export DOCKER_REGISTRY=myusername   # Docker Hub username or org
#    export IMAGE_TAG=latest             # optional, defaults to latest
#    export PUSH=true                    # optional, set false to build-only
#    ./scripts/build.sh
#
#  Or inline:
#    DOCKER_REGISTRY=myuser IMAGE_TAG=v1.2.0 ./scripts/build.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
PUSH="${PUSH:-true}"
PLATFORM="${PLATFORM:-linux/amd64}"

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓  $1${NC}"; }
info() { echo -e "${CYAN}▶  $1${NC}"; }
fail() { echo -e "${RED}✗  $1${NC}" >&2; exit 1; }

# ── Validate ──────────────────────────────────────────────────────────────────
[[ -z "$DOCKER_REGISTRY" ]] && fail "DOCKER_REGISTRY is not set. Export your Docker Hub username:\n  export DOCKER_REGISTRY=myusername"
command -v docker >/dev/null 2>&1 || fail "docker not found"

if [[ "$PUSH" == "true" ]]; then
  docker info --format '{{.RegistryConfig.IndexConfigs}}' | grep -q 'docker.io' || \
    fail "Not logged in to Docker Hub. Run: docker login"
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  HomeBanking — Docker Build & Push                   ║${NC}"
echo -e "${CYAN}║  Registry : ${DOCKER_REGISTRY}$(printf '%*s' $((37-${#DOCKER_REGISTRY})) '')║${NC}"
echo -e "${CYAN}║  Tag      : ${IMAGE_TAG}$(printf '%*s' $((37-${#IMAGE_TAG})) '')║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Service definitions: "image-suffix:build-context" ────────────────────────
# Using a plain array (colon-separated) — compatible with bash 3.x (macOS default)
SERVICES=(
  "auth-service:services/auth-service"
  "account-service:services/account-service"
  "notification-service:services/notification-service"
  "transaction-service:services/transaction-service"
  "api-gateway:services/api-gateway"
  "web-frontend:services/web-frontend"
  "load-generator:services/load-generator"
  "nginx:nginx"
)

BUILT=()
FAILED=()

build_and_push() {
  local name=$1
  local context="$ROOT/$2"
  local image="$DOCKER_REGISTRY/homebanking-$name:$IMAGE_TAG"
  local latest="$DOCKER_REGISTRY/homebanking-$name:latest"

  info "Building $image ..."
  if docker buildx build \
      --platform "$PLATFORM" \
      --shm-size=256m \
      --label "org.opencontainers.image.version=$IMAGE_TAG" \
      --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      -t "$image" \
      --load \
      "$context"; then
    ok "Built $image"
    BUILT+=("$image")

    # Also tag as :latest when a specific version is provided
    if [[ "$IMAGE_TAG" != "latest" ]]; then
      docker tag "$image" "$latest"
    fi

    if [[ "$PUSH" == "true" ]]; then
      info "Pushing $image ..."
      docker buildx build \
          --platform "$PLATFORM" \
          --shm-size=256m \
          -t "$image" \
          $( [[ "$IMAGE_TAG" != "latest" ]] && echo "-t $latest" ) \
          --push \
          "$context"
      ok "Pushed $image"
    fi
  else
    echo -e "${RED}✗  FAILED: $name${NC}" >&2
    FAILED+=("$name")
  fi
}

# ── Build each service ────────────────────────────────────────────────────────
for entry in "${SERVICES[@]}"; do
  svc_name="${entry%%:*}"
  svc_ctx="${entry#*:}"
  build_and_push "$svc_name" "$svc_ctx"
done

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Built successfully (${#BUILT[@]}):${NC}"
for img in "${BUILT[@]}"; do echo "  $img"; done

if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo ""
  echo -e "${RED}Failed (${#FAILED[@]}):${NC}"
  for svc in "${FAILED[@]}"; do echo "  $svc"; done
  exit 1
fi

echo ""
if [[ "$PUSH" == "true" ]]; then
  ok "All images pushed to Docker Hub under ${DOCKER_REGISTRY}/"
else
  ok "All images built locally (PUSH=false — skipped push)"
fi

echo ""
echo "Next step: deploy to AKS"
echo "  export DOCKER_REGISTRY=$DOCKER_REGISTRY"
echo "  export IMAGE_TAG=$IMAGE_TAG"
echo "  envsubst < k8s-aks/01-secrets.yaml | kubectl apply -f -"
echo "  kubectl apply -f k8s-aks/"


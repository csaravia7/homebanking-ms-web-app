#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  HomeBanking Microservices — Local Development Startup
#  Usage: ./scripts/dev-start.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="/tmp/homebanking-logs"
mkdir -p "$LOG_DIR"

# Use the project virtualenv Python so packages (uvicorn, fastapi, …) are available
VENV_PYTHON="$ROOT/venv/bin/python"
[ -x "$VENV_PYTHON" ] || VENV_PYTHON=python3   # fallback if venv missing

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
info() { echo -e "${CYAN}→ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}" >&2; exit 1; }

# ── Prerequisites ─────────────────────────────────────────────────────────────
command -v node   >/dev/null 2>&1 || fail "node not found — install Node.js 18+"
command -v python3>/dev/null 2>&1 || fail "python3 not found"
command -v mvn    >/dev/null 2>&1 || fail "mvn not found — install Maven 3.9+"
command -v psql   >/dev/null 2>&1 || fail "psql not found — install PostgreSQL"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   HomeBanking — Starting Local Services      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── PostgreSQL ────────────────────────────────────────────────────────────────
info "Checking PostgreSQL..."
pg_isready >/dev/null 2>&1 || fail "PostgreSQL is not running. Start it first."

psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='homebank'" | grep -q 1 || \
  psql -d postgres -c "CREATE USER homebank WITH PASSWORD 'secure123';" >/dev/null 2>&1

psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='homebanking_db'" | grep -q 1 || \
  psql -d postgres -c "CREATE DATABASE homebanking_db OWNER homebank;" >/dev/null 2>&1
ok "PostgreSQL ready"

# ── Helper: wait for HTTP health endpoint ─────────────────────────────────────
wait_for() {
  local name=$1 url=$2 max=${3:-30} i=0
  printf "  Waiting for %s" "$name"
  until curl -sf "$url" >/dev/null 2>&1; do
    i=$((i+1)); [ $i -ge $max ] && { echo ""; fail "$name failed to start (${max}s timeout)"; }
    printf "."; sleep 1
  done
  echo ""; ok "$name is ready"
}

# ── Auth Service (Node.js :3001) ──────────────────────────────────────────────
lsof -nti:3001 | xargs kill -9 2>/dev/null || true
info "Starting Auth Service..."
cd "$ROOT/services/auth-service"
[ -d node_modules ] || npm install --silent
npx ts-node src/index.ts < /dev/null > "$LOG_DIR/auth.log" 2>&1 &
wait_for "Auth Service" "http://localhost:3001/health"

# ── Account Service (Python :3003) ────────────────────────────────────────────
lsof -nti:3003 | xargs kill -9 2>/dev/null || true
info "Starting Account Service..."
cd "$ROOT/services/account-service"
"$VENV_PYTHON" -m uvicorn app:app --host 0.0.0.0 --port 3003 < /dev/null > "$LOG_DIR/account.log" 2>&1 &
wait_for "Account Service" "http://localhost:3003/health"

# ── Notification Service (Python :3005) ───────────────────────────────────────
lsof -nti:3005 | xargs kill -9 2>/dev/null || true
info "Starting Notification Service..."
cd "$ROOT/services/notification-service"
"$VENV_PYTHON" -m uvicorn app:app --host 0.0.0.0 --port 3005 < /dev/null > "$LOG_DIR/notification.log" 2>&1 &
wait_for "Notification Service" "http://localhost:3005/health"

# ── Transaction Service (Java/Spring :3004) ───────────────────────────────────
lsof -nti:3004 | xargs kill -9 2>/dev/null || true
info "Starting Transaction Service (Maven build may take ~15s)..."
cd "$ROOT/services/transaction-service"
mvn spring-boot:run -q < /dev/null > "$LOG_DIR/transaction.log" 2>&1 &
wait_for "Transaction Service" "http://localhost:3004/transactions/health" 60

# ── API Gateway (Node.js :8080) ───────────────────────────────────────────────
lsof -nti:8080 | xargs kill -9 2>/dev/null || true
info "Starting API Gateway..."
cd "$ROOT/services/api-gateway"
[ -d node_modules ] || npm install --silent
npx ts-node src/index.ts < /dev/null > "$LOG_DIR/gateway.log" 2>&1 &
wait_for "API Gateway" "http://localhost:8080/health"

# ── Frontend (Vite :3008) ─────────────────────────────────────────────────────
pkill -f vite 2>/dev/null || true; sleep 1
lsof -nti:3008 | xargs kill -9 2>/dev/null || true
info "Starting Frontend (Vite)..."
cd "$ROOT/services/web-frontend"
[ -d node_modules ] || npm install --silent
npm run dev < /dev/null > "$LOG_DIR/frontend.log" 2>&1 &
wait_for "Frontend" "http://localhost:3008" 30

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         All Services are Running! 🚀         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC}          http://localhost:3008"
echo -e "  ${CYAN}API Gateway:${NC}       http://localhost:8080"
echo -e "  ${CYAN}Auth Service:${NC}      http://localhost:3001"
echo -e "  ${CYAN}Account Service:${NC}   http://localhost:3003"
echo -e "  ${CYAN}Transaction Svc:${NC}   http://localhost:3004"
echo -e "  ${CYAN}Notification Svc:${NC}  http://localhost:3005"
echo ""
echo -e "  ${YELLOW}Logs:${NC}  $LOG_DIR/"
echo -e "  ${YELLOW}Demo credentials:${NC}  test@example.com / password123"
echo ""

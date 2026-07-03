#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  HomeBanking Microservices — Local Development Stop
#  Usage: ./scripts/dev-stop.sh
# ─────────────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
info() { echo -e "${YELLOW}→ $1${NC}"; }

echo ""
echo -e "${YELLOW}Stopping HomeBanking local services...${NC}"
echo ""

stop_port() {
  local name=$1 port=$2
  if lsof -nti:$port >/dev/null 2>&1; then
    lsof -nti:$port | xargs kill -9 2>/dev/null || true
    ok "Stopped $name (port $port)"
  else
    echo "  - $name (port $port): not running"
  fi
}

# Stop all services by port
stop_port "Frontend"             3008
stop_port "API Gateway"          8080
stop_port "Auth Service"         3001
stop_port "Account Service"      3003
stop_port "Transaction Service"  3004
stop_port "Notification Service" 3005

# Kill any remaining vite/ts-node/mvn processes for this project
pkill -f "vite.*homebanking"           2>/dev/null || true
pkill -f "ts-node.*homebanking"        2>/dev/null || true
pkill -f "TransactionServiceApplication" 2>/dev/null || true
pkill -f "uvicorn.*account"            2>/dev/null || true
pkill -f "uvicorn.*notification"       2>/dev/null || true

echo ""
ok "All services stopped"
echo ""

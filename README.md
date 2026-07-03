# HomeBanking · Microservices Platform

A production-grade banking platform built with heterogeneous microservices, deployable to **Azure Kubernetes Service (AKS)**. Designed to demonstrate enterprise patterns: API Gateway, observability, user isolation, feature flags, and reverse proxy configuration.

---

## Architecture

```
Browser / React SPA
        │
        ▼
   Nginx (Port 80)          ← Reverse Proxy + Rate Limiting
        │
        ▼
  API Gateway :8080         ← Node.js · Single entry point for all APIs
  ┌─────┬──────┬────────┬──────────┐
  ▼     ▼      ▼        ▼          ▼
Auth  Account  Transact  Notif    (Cards)
:3001  :3003   :3004    :3005     (via account-service)
Node  Python  Java/Spring Python
SQLite in-mem PostgreSQL in-mem
```

**Observability stack:** OpenTelemetry Collector → Jaeger (traces) · Prometheus (metrics) · Grafana (dashboards)

---

## Services

| Service | Language | Port | Storage |
|---|---|---|---|
| `api-gateway` | Node.js / Express | 8080 | — |
| `auth-service` | Node.js / Express | 3001 | SQLite |
| `account-service` | Python / FastAPI | 3003 | In-memory |
| `transaction-service` | Java / Spring Boot | 3004 | PostgreSQL |
| `notification-service` | Python / FastAPI | 3005 | In-memory |
| `web-frontend` | React 18 + TypeScript + MUI | 3008 | — |
| `nginx` | Nginx 1.25 | 80 | — |

---

## Quick Start — Local Development

### Prerequisites
- Node.js 18+ · Python 3.11+ · Java 17+ · Maven 3.9+ · PostgreSQL 14+

```bash
# Start all services
./scripts/dev-start.sh

# Stop all services
./scripts/dev-stop.sh
```

**Demo credentials:** `test@example.com` / `password123`

Frontend: http://localhost:3008 · API Gateway: http://localhost:8080

### Manual Setup

```bash
# 1. Auth Service
cd services/auth-service && npm install && npx ts-node src/index.ts

# 2. Account + Notification Services
cd services/account-service && uvicorn app:app --port 3003
cd services/notification-service && uvicorn app:app --port 3005

# 3. Transaction Service (requires PostgreSQL homebanking_db)
cd services/transaction-service && mvn spring-boot:run

# 4. API Gateway
cd services/api-gateway && npm install && npx ts-node src/index.ts

# 5. Frontend
cd services/web-frontend && npm install && npm run dev
```

---

## Docker Compose

```bash
cp .env.example .env
docker-compose up -d          # Full stack
docker-compose -f docker-compose-infra.yml up -d  # Infrastructure only
docker-compose logs -f [service-name]
docker-compose down -v        # Stop + remove volumes
```

---

## AKS Deployment

```bash
# 1. Build and push images
./scripts/build.sh

# 2. Set AKS context
az aks get-credentials --resource-group <rg> --name <cluster>

# 3. Deploy manifests in order
kubectl apply -f k8s/01-namespace-configmap.yaml
kubectl apply -f k8s/02-secrets-pvc.yaml
kubectl apply -f k8s/03-postgres-rabbitmq.yaml
kubectl apply -f k8s/04-otel-jaeger-prometheus-grafana.yaml
kubectl apply -f k8s/06-api-auth-services.yaml
kubectl apply -f k8s/07-microservices.yaml
kubectl apply -f k8s/08-nginx-ingress.yaml

# 4. Check rollout
kubectl rollout status deployment -n homebanking
```

The nginx reverse proxy (`nginx/nginx.conf`) handles TLS termination, rate limiting, and routing in production.

---

## Project Structure

```
homebanking/
├── services/
│   ├── api-gateway/          # Node.js gateway — routes all API calls
│   ├── auth-service/         # JWT authentication + user management
│   ├── account-service/      # Accounts, cards, user isolation
│   ├── transaction-service/  # Transactions with PostgreSQL persistence
│   ├── notification-service/ # Notifications (in-memory)
│   └── web-frontend/         # React SPA with Material-UI
├── nginx/nginx.conf          # Reverse proxy configuration
├── k8s/                      # Kubernetes manifests (AKS-ready)
├── scripts/                  # dev-start.sh · dev-stop.sh · deploy-to-aks.sh
├── docker-compose.yml        # Full local stack
└── otel-collector/           # OpenTelemetry Collector config
```

---

## Key Features

- **User Isolation** — Accounts, cards, and transactions are scoped per authenticated user via JWT
- **Feature Flags** — Toggle intentional failures and degraded behaviours for observability testing
- **Balance Coherence** — Account balance auto-updates on every transaction (credit/debit)
- **Duplicate Card Prevention** — One card type per account enforced at both client and server
- **Rate Limiting** — Nginx applies per-IP rate limits on all endpoints
- **OpenTelemetry** — Distributed traces propagated across all services

---

## Environment Variables

Copy `.env.example` → `.env` and adjust:

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | `your-secret-key` | JWT signing secret |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_USER` | `homebank` | PostgreSQL user |
| `DB_PASSWORD` | `secure123` | PostgreSQL password |
| `AUTH_SERVICE_URL` | `http://localhost:3001` | Internal URL |
| `ACCOUNT_SERVICE_URL` | `http://localhost:3003` | Internal URL |
| `TRANSACTION_SERVICE_URL` | `http://localhost:3004` | Internal URL |
| `NOTIFICATION_SERVICE_URL` | `http://localhost:3005` | Internal URL |


---


kubectl -n homebanking create secret generic dynatrace-credentials \
  --from-literal=DYNATRACE_ENVIRONMENT_ID=abc12345 \
  --from-literal=DYNATRACE_API_TOKEN=dt0c01.XXXXX

---

## Load Generator

Simula tráfico real de usuarios usando Playwright / Chromium headless.
El deployment se despliega con `replicas: 0` por defecto — actívalo manualmente:

```bash
# Activar generación de carga
kubectl scale deployment/load-generator -n homebanking --replicas=1

# Verificar que el pod arrancó
kubectl get pod -n homebanking -l app=load-generator -w

# Ver los logs en tiempo real
kubectl logs -n homebanking -l app=load-generator -f

# Detener
kubectl scale deployment/load-generator -n homebanking --replicas=0
```
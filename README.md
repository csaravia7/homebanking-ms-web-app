# HomeBanking · Microservices Platform

A production-grade banking platform built with heterogeneous microservices, deployable to **Azure Kubernetes Service (AKS)**. Designed to demonstrate enterprise patterns: API Gateway, observability, user isolation, feature flags, and reverse proxy configuration.

---

## Architecture

```
Browser / React SPA
        │
        ▼
  web-frontend :80           ← nginx · SPA + proxy_pass /api → api-gateway
        │
        ▼
  API Gateway :8080          ← Java/Spring Boot · Único punto de entrada para todas las APIs
  ┌─────┬──────┬────────┬──────────┐
  ▼     ▼      ▼        ▼          ▼
Auth  Account  Transact  Notif    (Cards)
:3001  :3003   :3004    :3005     (via account-service)
Java  Python  Java/Spring Python
SQLite  PgSQL  PostgreSQL in-mem

        ▼  (todos los servicios)
  OTel Collector :4317/4318  ← k8sattributes + cumulativetodelta + transform
        │
        ▼
  Dynatrace (trazas + métricas + logs)
```

**Observability:** OTel Operator (auto-instrumentación) → OTel Collector → Dynatrace

---

## Services

| Servicio | Lenguaje | Puerto | Storage |
|---|---|---|---|
| `api-gateway` | Java / Spring Boot | 8080 | — |
| `auth-service` | Java / Spring Boot | 3001 | SQLite (emptyDir en K8s) |
| `account-service` | Python / FastAPI | 3003 | **PostgreSQL** (SQLAlchemy) |
| `transaction-service` | Java / Spring Boot | 3004 | PostgreSQL |
| `notification-service` | Python / FastAPI | 3005 | In-memory |
| `web-frontend` | React 18 + TypeScript + MUI | 80 (K8s) / 3008 (local) | — |
| `nginx` | Nginx 1.25 | 80 | — |
| `load-generator` | Python / Playwright | — | — |

---

## Quick Start — Desarrollo Local

### Prerequisitos
Node.js 18+ · Python 3.11+ · Java 17+ · Maven 3.9+ · PostgreSQL 14+

```bash
# Activar el virtualenv del proyecto
source venv/bin/activate

# Iniciar todos los servicios
./scripts/dev-start.sh

# Detener todos los servicios
./scripts/dev-stop.sh
```

**Credenciales demo:** `test@example.com` / `password123`

Frontend: http://localhost:3008 · API Gateway: http://localhost:8080

> El script `dev-start.sh` usa `venv/bin/python` para los servicios Python
> (account-service y notification-service) y asegura que uvicorn esté disponible.

---

## Docker Compose

```bash
cp .env.example .env
docker-compose up -d                              # Stack completo
docker-compose -f docker-compose-infra.yml up -d  # Solo infraestructura
docker-compose logs -f [nombre-servicio]
docker-compose down -v                            # Detener + borrar volúmenes
```

---

## AKS Deployment

### 1. Build & Push a Docker Hub

```bash
export DOCKER_REGISTRY=miusuario   # tu usuario de Docker Hub
export IMAGE_TAG=v1.0.0
./scripts/build.sh
```

### 2. Prerequisitos en el cluster

```bash
# Azure CLI autenticado
az login
az aks get-credentials --resource-group <rg> --name <cluster>

# Helm (para OTel Operator)
brew install helm
```

### 3. Desplegar

```bash
export DOCKER_REGISTRY=miusuario
export IMAGE_TAG=v1.0.0
# El script pide el Environment ID y API Token de Dynatrace de forma interactiva
./scripts/deploy-k8s.sh
```

El script hace automáticamente:
- Crea el namespace `homebanking`
- Crea el secret `dynatrace-credentials`
- Instala cert-manager y el OTel Operator (si no están)
- Aplica los manifests en orden correcto (OTel Collector e Instrumentation CRD antes que los servicios)
- Hace rollout restart para activar la auto-instrumentación
- Muestra las IPs públicas del frontend y API gateway

### 4. Verificar el despliegue

```bash
kubectl get pods -n homebanking
kubectl get svc -n homebanking
```

### 5. Desinstalar

```bash
./scripts/uninstall-k8s.sh

# Opciones adicionales:
DELETE_PVC=true ./scripts/uninstall-k8s.sh          # borra datos de PostgreSQL
DELETE_INGRESS=true ./scripts/uninstall-k8s.sh      # borra ingress-nginx
DELETE_OPERATOR=true ./scripts/uninstall-k8s.sh     # borra OTel Operator y cert-manager
```

---

## Estructura del Proyecto

```
homebanking-ms-web-app/
├── services/
│   ├── api-gateway/          # Java/Spring Boot — enruta todas las llamadas API
│   ├── auth-service/         # JWT auth + gestión de usuarios (SQLite)
│   ├── account-service/      # Cuentas y tarjetas (PostgreSQL via SQLAlchemy)
│   ├── transaction-service/  # Transacciones (PostgreSQL via Spring JPA)
│   ├── notification-service/ # Notificaciones (in-memory)
│   ├── web-frontend/         # React SPA + nginx (proxy_pass /api)
│   └── load-generator/       # Generador de carga Playwright/Chromium
├── nginx/nginx.conf          # Configuración reverse proxy
├── k8s-aks/                  # Manifests Kubernetes para AKS
│   ├── 00-namespace.yaml
│   ├── 01-secrets.yaml
│   ├── 02-configmap.yaml
│   ├── 03-postgres.yaml
│   ├── 04-rabbitmq.yaml
│   ├── 05-auth-service.yaml
│   ├── 06-account-service.yaml
│   ├── 07-transaction-service.yaml
│   ├── 08-notification-service.yaml
│   ├── 09-api-gateway.yaml
│   ├── 10-web-frontend.yaml
│   ├── 11-ingress-hpa.yaml
│   ├── 12-otel-collector.yaml
│   ├── 12b-otel-collector-rbac.yaml
│   ├── 13-otel-instrumentation.yaml
│   └── 14-load-generator.yaml
├── scripts/
│   ├── dev-start.sh          # Inicia servicios en local
│   ├── dev-stop.sh           # Detiene servicios en local
│   ├── build.sh              # Build + push Docker Hub
│   ├── deploy-k8s.sh         # Deploy completo a AKS
│   └── uninstall-k8s.sh      # Desinstalar del cluster
├── docker-compose.yml        # Stack completo local
└── otel-collector/           # Config OTel Collector (referencia local)
```

---

## Observabilidad — Dynatrace + OTel

La instrumentación usa el **OTel Operator** (auto-inyección sin cambios en el código):

| Componente | Función |
|---|---|
| OTel Operator | Inyecta el SDK vía init-container según anotaciones en los pods |
| `13-otel-instrumentation.yaml` | CRD que define qué SDK inyectar por lenguaje |
| OTel Collector (`12-*.yaml`) | Recibe trazas/métricas/logs, enriquece con K8s metadata y exporta a Dynatrace |
| `k8sattributes` processor | Añade `k8s.pod.name`, `k8s.deployment.name`, `k8s.cluster.name`, etc. |
| `cumulativetodelta` processor | Convierte métricas acumulativas a delta (requerido por Dynatrace) |

### Configurar credenciales Dynatrace

```bash
kubectl -n homebanking create secret generic dynatrace-credentials \
  --from-literal=DYNATRACE_ENVIRONMENT_ID=<tu-env-id> \
  --from-literal=DYNATRACE_API_TOKEN=<dt0c01.tu-token>
```

El API Token necesita los scopes: `openTelemetryTrace.ingest` · `metrics.ingest` · `logs.ingest`

---

## Key Features

- **PostgreSQL para cuentas** — `account-service` persiste cuentas y tarjetas en PostgreSQL (migrado desde in-memory)
- **User Isolation** — Cuentas, tarjetas y transacciones aisladas por usuario vía JWT
- **Proxy unificado** — El frontend nginx hace `proxy_pass` a `/api` → api-gateway, un solo IP público
- **Auto-instrumentación OTel** — SDK inyectado automáticamente por el Operator sin modificar el código fuente
- **K8s Metadata Enrichment** — OTel Collector enriquece toda la telemetría con atributos K8s
- **HPA** — Horizontal Pod Autoscaler para api-gateway, account-service y transaction-service
- **Rate Limiting** — Nginx aplica límites de tasa por IP
- **Load Generator** — Playwright/Chromium simula usuarios reales para pruebas de carga

---

## Variables de Entorno

Copia `.env.example` → `.env` y ajusta:

| Variable | Default | Descripción |
|---|---|---|
| `JWT_SECRET` | `your-secret-key` | Secreto de firma JWT |
| `DB_HOST` | `localhost` | Host de PostgreSQL |
| `DB_USER` | `homebank` | Usuario PostgreSQL |
| `DB_PASSWORD` | `secure123` | Contraseña PostgreSQL |
| `AUTH_SERVICE_URL` | `http://localhost:3001` | URL interna |
| `ACCOUNT_SERVICE_URL` | `http://localhost:3003` | URL interna |
| `TRANSACTION_SERVICE_URL` | `http://localhost:3004` | URL interna |
| `NOTIFICATION_SERVICE_URL` | `http://localhost:3005` | URL interna |
| `VITE_API_URL` | `""` (vacío) | Base URL del API (vacío = rutas relativas, nginx hace el proxy) |

---

## Load Generator

Simula tráfico real de usuarios con Playwright / Chromium headless.
Se despliega con `replicas: 0` por defecto — actívalo manualmente:

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
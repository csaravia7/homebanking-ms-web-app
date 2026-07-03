# Homebanking Microservices - Architecture Diagram

## System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WebClient["Web Browser<br/>Client"]
        MobileClient["Mobile App"]
    end

    subgraph "API Gateway Layer"
        Nginx["Nginx<br/>Reverse Proxy<br/>Port: 80/443"]
    end

    subgraph "API Layer"
        APIGateway["API Gateway<br/>Node.js<br/>Port: 8080"]
    end

    subgraph "Microservices"
        AuthService["Auth Service<br/>Node.js<br/>Port: 3001<br/>JWT/OAuth"]
        AccountService["Account Service<br/>Python/FastAPI<br/>Port: 3003<br/>Account Management"]
        TransactionService["Transaction Service<br/>Java/Spring Boot<br/>Port: 3004<br/>Transactions"]
        NotificationService["Notification Service<br/>Python/FastAPI<br/>Port: 3005<br/>Notifications"]
    end

    subgraph "Data Layer"
        PostgreSQL["PostgreSQL<br/>Primary DB<br/>Port: 5432"]
        Redis["Redis Cache<br/>Port: 6379"]
    end

    subgraph "Message Queue"
        RabbitMQ["RabbitMQ<br/>Message Broker<br/>Port: 5672"]
    end

    subgraph "Observability Stack"
        OTELCollector["OpenTelemetry<br/>Collector"]
        Jaeger["Jaeger<br/>Distributed Tracing<br/>Port: 16686"]
        Prometheus["Prometheus<br/>Metrics<br/>Port: 9090"]
        Grafana["Grafana<br/>Dashboards<br/>Port: 3000"]
    end

    WebClient -->|HTTP/HTTPS| Nginx
    MobileClient -->|HTTP/HTTPS| Nginx
    Nginx --> APIGateway
    
    APIGateway -->|REST| AuthService
    APIGateway -->|REST| AccountService
    APIGateway -->|REST| TransactionService
    APIGateway -->|REST| NotificationService
    
    AuthService --> PostgreSQL
    AccountService --> PostgreSQL
    TransactionService --> PostgreSQL
    NotificationService --> PostgreSQL
    
    NotificationService --> RabbitMQ
    
    AuthService --> Redis
    AccountService --> Redis
    
    AuthService -->|OTLP| OTELCollector
    AccountService -->|OTLP| OTELCollector
    TransactionService -->|OTLP| OTELCollector
    NotificationService -->|OTLP| OTELCollector
    APIGateway -->|OTLP| OTELCollector
    
    OTELCollector --> Jaeger
    OTELCollector --> Prometheus
    Prometheus --> Grafana
    
    style WebClient fill:#e1f5ff
    style MobileClient fill:#e1f5ff
    style Nginx fill:#fff3e0
    style APIGateway fill:#f3e5f5
    style AuthService fill:#f3e5f5
    style AccountService fill:#f3e5f5
    style TransactionService fill:#f3e5f5
    style NotificationService fill:#f3e5f5
    style PostgreSQL fill:#e8f5e9
    style Redis fill:#e8f5e9
    style RabbitMQ fill:#fce4ec
    style OTELCollector fill:#f1f8e9
    style Jaeger fill:#f1f8e9
    style Prometheus fill:#f1f8e9
    style Grafana fill:#f1f8e9
```

## Data Flow Examples

### Authentication Flow
```
Client → Nginx → API Gateway → Auth Service → PostgreSQL
   ↓
Auth Service → JWT Token → API Gateway → Client
```

### Transaction Flow
```
Client → Nginx → API Gateway → Transaction Service → PostgreSQL
            ↓
         Account Service (verify balance)
            ↓
      Transaction Service → RabbitMQ → Notification Service
            ↓
      PostgreSQL (stores transaction) ← Notification Service
```

### Observability Flow
```
Services → OpenTelemetry SDK
    ↓
OTLP Exporter
    ↓
OpenTelemetry Collector
    ↓
┌─────────────┬─────────────┬──────────┐
↓             ↓             ↓          
Jaeger    Prometheus    Loki      Grafana (visualization)
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React/Vue | Web UI |
| **API Gateway** | Nginx | Reverse proxy, load balancing |
| **API Layer** | Node.js | Request routing |
| **Services** | Node.js, Python, Java | Business logic |
| **Database** | PostgreSQL | Primary data store |
| **Cache** | Redis | Session/cache layer |
| **Message Queue** | RabbitMQ | Async messaging |
| **Tracing** | Jaeger | Distributed tracing |
| **Metrics** | Prometheus | Metrics collection |
| **Visualization** | Grafana | Dashboard |
| **Container** | Docker | Containerization |
| **Orchestration** | Kubernetes/AKS | Container orchestration |

## Deployment Architecture (AKS)

```
Azure Subscription
├── Resource Group
│   ├── AKS Cluster
│   │   ├── Node Pool 1 (3 nodes)
│   │   └── Namespace: homebanking
│   │       ├── API Gateway Pod (2 replicas)
│   │       ├── Auth Service Pod (2 replicas)
│   │       ├── Account Service Pod (2 replicas)
│   │       ├── Transaction Service Pod (2 replicas)
│   │       ├── Notification Service Pod (2 replicas)
│   │       ├── PostgreSQL StatefulSet
│   │       ├── RabbitMQ Deployment
│   │       ├── OpenTelemetry Collector
│   │       ├── Jaeger
│   │       ├── Prometheus
│   │       └── Grafana
│   ├── Container Registry (ACR)
│   └── Load Balancer
```

## Security Architecture

```
┌─────────────────────────────────────┐
│    Azure Key Vault                  │
│  (JWT Secret, DB Credentials)       │
└────────────┬────────────────────────┘
             │
     ┌───────┴────────┐
     ▼                ▼
Network Policy    Pod Security Policy
- Ingress         - No root
- Egress          - Capabilities
                  - Read-only FS

     │
     ▼
Services (Internal)
- No external access
- Service-to-service via internal DNS
```

## High Availability Configuration

- **Replicas:** 2 per service
- **Pod Disruption Budget:** Minimum 1 pod available
- **Health Checks:** Liveness and readiness probes
- **Resource Limits:** CPU and Memory defined
- **Auto-scaling:** HPA based on CPU/Memory metrics

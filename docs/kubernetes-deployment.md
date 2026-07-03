# Kubernetes Deployment Guide

## Prerequisites

- Azure CLI (`az`) installed and configured
- `kubectl` installed
- Access to an AKS cluster
- Container registry (Azure Container Registry)

## Deployment Steps

### 1. Create AKS Cluster (if not exists)

```bash
# Set variables
export RESOURCE_GROUP="homebanking-rg"
export CLUSTER_NAME="homebanking-aks"
export LOCATION="eastus"
export REGISTRY_NAME="homebankingregistry"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create AKS cluster
az aks create \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --node-count 3 \
  --vm-set-type VirtualMachineScaleSets \
  --enable-managed-identity \
  --network-plugin azure \
  --generate-ssh-keys

# Get credentials
az aks get-credentials --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME
```

### 2. Create Container Registry

```bash
# Create registry
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $REGISTRY_NAME \
  --sku Basic

# Get registry URL
export REGISTRY_URL=$(az acr show \
  --resource-group $RESOURCE_GROUP \
  --name $REGISTRY_NAME \
  --query loginServer \
  --output tsv)

echo $REGISTRY_URL
```

### 3. Build and Push Container Images

```bash
# Login to registry
az acr login --name $REGISTRY_NAME

# Build images
cd homebanking

# API Gateway
az acr build \
  --registry $REGISTRY_NAME \
  --image api-gateway:latest \
  ./services/api-gateway

# Auth Service
az acr build \
  --registry $REGISTRY_NAME \
  --image auth-service:latest \
  ./services/auth-service

# Account Service
az acr build \
  --registry $REGISTRY_NAME \
  --image account-service:latest \
  ./services/account-service

# Transaction Service
az acr build \
  --registry $REGISTRY_NAME \
  --image transaction-service:latest \
  ./services/transaction-service

# Notification Service
az acr build \
  --registry $REGISTRY_NAME \
  --image notification-service:latest \
  ./services/notification-service
```

### 4. Update Kubernetes Manifests

Edit the image references in `k8s/06-api-auth-services.yaml` and `k8s/07-microservices.yaml`:

```bash
# Replace the registry URL in all manifests
sed -i "s|your-registry.azurecr.io|$REGISTRY_URL|g" k8s/*.yaml
```

### 5. Deploy to AKS

```bash
# Apply manifests in order
kubectl apply -f k8s/01-namespace-configmap.yaml
kubectl apply -f k8s/02-secrets-pvc.yaml
kubectl apply -f k8s/03-postgres-rabbitmq.yaml
kubectl apply -f k8s/04-otel-jaeger-prometheus-grafana.yaml
kubectl apply -f k8s/05-otel-collector.yaml
kubectl apply -f k8s/06-api-auth-services.yaml
kubectl apply -f k8s/07-microservices.yaml
kubectl apply -f k8s/08-nginx-ingress.yaml

# Verify deployment
kubectl get pods -n homebanking
kubectl get svc -n homebanking
```

### 6. Configure Azure Container Registry Integration

```bash
# Attach ACR to AKS cluster
az aks update \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --attach-acr $REGISTRY_NAME
```

## Accessing the Application

### Get External IP

```bash
kubectl get svc nginx -n homebanking
```

Wait a few minutes for the LoadBalancer IP to be assigned.

### Port Forwarding (for development)

```bash
# Jaeger
kubectl port-forward svc/jaeger -n homebanking 16686:16686

# Prometheus
kubectl port-forward svc/prometheus -n homebanking 9090:9090

# Grafana
kubectl port-forward svc/grafana -n homebanking 3000:3000

# API Gateway
kubectl port-forward svc/api-gateway -n homebanking 8080:8080
```

## Monitoring & Troubleshooting

### Check Pod Status

```bash
kubectl get pods -n homebanking
kubectl describe pod <pod-name> -n homebanking
kubectl logs <pod-name> -n homebanking
```

### View Events

```bash
kubectl get events -n homebanking
```

### Check Resource Usage

```bash
kubectl top nodes
kubectl top pods -n homebanking
```

### Scale Deployments

```bash
# Scale API Gateway to 3 replicas
kubectl scale deployment api-gateway --replicas=3 -n homebanking
```

## Database Migrations

```bash
# Forward postgres port
kubectl port-forward svc/postgres -n homebanking 5432:5432

# Run migrations (from local machine)
psql -h localhost -U homebank -d homebanking_db -f init.sql
```

## Updating Deployments

```bash
# Update image
kubectl set image deployment/api-gateway \
  api-gateway=$REGISTRY_URL/api-gateway:v2 \
  -n homebanking

# Rollback
kubectl rollout undo deployment/api-gateway -n homebanking

# Check rollout status
kubectl rollout status deployment/api-gateway -n homebanking
```

## Cleanup

```bash
# Delete all resources
kubectl delete namespace homebanking

# Delete AKS cluster
az aks delete --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME

# Delete resource group
az group delete --name $RESOURCE_GROUP
```

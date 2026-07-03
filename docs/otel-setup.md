# OpenTelemetry Setup Guide

## Overview

The homebanking application uses OpenTelemetry to collect traces, metrics, and logs from all microservices.

## Architecture

```
Microservices
      ↓
OpenTelemetry SDK
      ↓
OTLP Exporter
      ↓
OpenTelemetry Collector
      ↓
Jaeger (Traces) | Prometheus (Metrics) | Loki (Logs)
      ↓
Grafana (Visualization)
```

## Configuration

### Service Configuration

Each microservice is configured with OpenTelemetry environment variables:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_EXPORTER_OTLP_INSECURE=true
OTEL_SERVICE_NAME=<service-name>
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
```

### OpenTelemetry Collector Configuration

The collector is configured to:
- Receive OTLP traces via gRPC (port 4317) and HTTP (port 4318)
- Export traces to Jaeger
- Export metrics to Prometheus
- Apply batch processing and memory limiting

## Accessing Observability Tools

### Jaeger (Distributed Tracing)

**URL:** http://localhost:16686

Features:
- Distributed tracing across all services
- Latency analysis
- Error tracking
- Service dependencies

### Prometheus (Metrics)

**URL:** http://localhost:9090

Available metrics:
- Request rate
- Response time (p50, p95, p99)
- Error rate
- Resource utilization

### Grafana (Dashboards)

**URL:** http://localhost:3000
**Default:** admin/admin

Pre-configured dashboards:
- Service Health Overview
- Request Performance
- Database Operations
- OpenTelemetry Collector Metrics

## Service Instrumentation

### Node.js Services (API Gateway, Auth Service)

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('service-name');

// Create span
const span = tracer.startSpan('operation-name');
try {
  // Your code
  span.setAttributes({ key: value });
} finally {
  span.end();
}
```

### Python Services (Account Service, Notification Service)

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

with tracer.start_as_current_span("operation-name") as span:
    span.set_attribute("key", "value")
    # Your code
```

### Java Service (Transaction Service)

```java
import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.trace.Tracer;

private final Tracer tracer = GlobalOpenTelemetry.getTracer(
    TransactionController.class.getName()
);

var span = tracer.spanBuilder("operation-name").startSpan();
try {
    span.setAttribute("key", "value");
    // Your code
} finally {
    span.end();
}
```

## Custom Metrics

### Defining Custom Metrics

```python
# Python example
from opentelemetry import metrics

meter = metrics.get_meter(__name__)
counter = meter.create_counter("transactions_total")
counter.add(1, {"operation": "deposit"})
```

## Sampling

To reduce trace volume in production, configure sampling:

```yaml
# In OpenTelemetry Collector
processors:
  sampling:
    traces:
      sampling_percentage: 10  # Sample 10% of traces
```

## Troubleshooting

### No Traces Appearing

1. Check service is connected to collector:
   ```bash
   kubectl logs -n homebanking <service-pod>
   ```

2. Verify collector is running:
   ```bash
   kubectl get pods -n homebanking | grep otel-collector
   kubectl logs -n homebanking otel-collector-*
   ```

3. Check network connectivity:
   ```bash
   kubectl exec -n homebanking <service-pod> -- curl http://otel-collector:4317
   ```

### High Memory Usage in Collector

Adjust batch processor settings in `otel-collector-config.yaml`:
```yaml
processors:
  batch:
    timeout: 10s
    send_batch_size: 256  # Reduce from 1024
```

## Performance Tuning

### For Development
- Sample 100% of traces
- Send immediately (no batching)
- Maximum verbosity

### For Production
- Sample 1-5% of traces
- Batch with 100-1000 items
- Memory limit: 512MB
- Spike limit: 128MB

## Best Practices

1. **Add contextual attributes to spans:**
   ```
   user_id, account_id, transaction_id
   ```

2. **Use meaningful span names:**
   ```
   ✓ db.query.users
   ✗ query
   ```

3. **Set span status on errors:**
   ```
   span.set_status(Status(StatusCode.ERROR))
   ```

4. **Use log correlation:**
   Include trace ID in logs for correlation

5. **Monitor collector health:**
   ```bash
   curl http://localhost:13133  # Health check
   ```

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)

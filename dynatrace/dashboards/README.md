# Homebanking — Dashboard Dynatrace

`homebanking-services-overview.json` es un dashboard nuevo (sin `id` — Dynatrace le asigna uno al crearlo). La estructura y convenciones de tile fueron adaptadas de un dashboard de producción real (`banco-estado-NWM.json`, provisto por el usuario) combinado con el formato/queries documentados en las skills de [Dynatrace/dynatrace-for-ai](https://github.com/Dynatrace/dynatrace-for-ai/tree/main/skills):

- `dt-app-dashboards` — estructura del JSON (tiles/layouts/grid de 24 columnas), tipos de tile y visualizaciones válidas.
- `dt-obs-services` — métricas RED (`dt.service.request.response_time`, `.count`, `.failure_count`) para los 5 microservicios.
- `dt-obs-kubernetes` — métricas de CPU, memoria, restarts y OOMKills por pod/workload en el namespace `homebanking`.

## Convenciones adoptadas del template de referencia

- **Filtro inline en `timeseries`**: `timeseries <metric>, by:{...}, filter: <condición>` en vez de un `| filter` posterior — así evitamos incluir la dimensión de filtro (`dt.service.name`, `k8s.namespace.name`) solo para poder filtrarla después.
- **Tile "Servicios" con `lookup` + sparklines**: una sola tabla combina, por servicio, tendencia (`bins: 40`) y valor reciente (`from: -10m, to: -2m`) de latencia p50, throughput y error rate, con columnas `Errores`/`Latencia_Promedio`/`Calls` renderizadas como sparkline (`columnTypeOverrides`). Las columnas `timeframe`/`interval` se agregan y se ocultan (`hiddenColumns`) porque el motor de sparklines las necesita para escalar el eje X.
- **`timeframe.tileTimeframeEnabled`** fijado a `-30m` en los tiles de tendencia/estado reciente (igual que el original), independiente del selector global del dashboard — no es lo mismo que hardcodear `from:`/`to:` dentro del texto DQL contra el que advierte la skill (eso rompería el time-picker global); acá es una propiedad soportada a nivel de tile.
- **`coloring.colorRules` / `thresholdRules`** con las mismas convenciones de color (`var(--dt-colors-charts-apdex-*)`) para marcar error rate ≥1%, latencia ≥500 ms, calls en 0 (servicio caído), restarts ≥5 y cualquier OOM kill.
- **`querySettings` y `davis` explícitos** en todos los tiles (antes estaban vacíos/ausentes), igual que en el template.

**Simplificación consciente:** omití el lookup de `smartscapeNodes SERVICE` para filtrar entidades con `lifetime.end` (servicios decomisionados) que tenía el original — no aporta en un entorno fijo de 5 servicios activos. Si el catálogo de servicios crece o rota, vale la pena reincorporarlo.

## Qué muestra

| Sección | Tiles |
|---|---|
| Tabla "Servicios" | Por servicio: error rate (tendencia + reciente), latencia p50 (tendencia + reciente), calls (tendencia + reciente), con sparklines y semáforo de color |
| RED agregado | Latencia p50/p90/p95/p99, Error Rate % y Calls — combinados de los 5 servicios (`auth-service`, `account-service`, `transaction-service`, `notification-service`, `api-gateway`) |
| Kubernetes (`namespace=homebanking`) | CPU y memoria por workload, Pod Restarts, OOM Kills |
| Problemas activos | Davis Problems activos que afectan servicios o entidades K8S_* |

## ⚠️ Antes de desplegar

Esta sesión no tuvo conexión activa al MCP server de Dynatrace (falta registrar credenciales), así que **las queries no fueron validadas contra un entorno real**. Siguiendo el workflow obligatorio de la skill `dt-app-dashboards`, antes de aplicar el dashboard:

1. Validá cada query del JSON con:
   ```bash
   dtctl query '<query del tile>' --plain
   ```
   o con la tool `execute_dql` / `verify_dql` del MCP una vez conectado.
2. Confirmá que los nombres de servicio (`dt.service.name`) coinciden exactamente con los que ves en tu entorno (pueden variar si `OTEL_SERVICE_NAME` no matchea el nombre esperado, especialmente en los 2 servicios Node.js — ver nota de logging/OTel de la conversación anterior).
3. Si alguna query no devuelve datos porque el runtime/metric no aplica (ej. `dt.kubernetes.container.oom_kills` si nunca hubo un OOM), es esperado — esos tiles usan `table`/`categoricalBarChart`, que no rompen con resultados vacíos.

## Deploy

```bash
dtctl apply -f dynatrace/dashboards/homebanking-services-overview.json -o yaml
# preview sin persistir:
dtctl apply -f dynatrace/dashboards/homebanking-services-overview.json -o yaml --dry-run
```

## Actualizaciones futuras

Para modificar este dashboard **después** de la primera vez que lo despliegues, no reconstruyas el JSON desde cero: descargá el estado actual del servidor (preserva ediciones hechas desde la UI) y modificá ese archivo:

```bash
dtctl get dashboard <id> -o json --plain > dynatrace/dashboards/homebanking-services-overview.json
```

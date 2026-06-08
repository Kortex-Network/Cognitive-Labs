# Performance Monitoring and Metrics Implementation Guide

## Overview

This document provides a comprehensive guide to the performance monitoring and metrics implementation for the Cognitive Lab Backend service. The implementation includes Prometheus metrics collection, Grafana dashboards, and a complete monitoring stack.

## Architecture

### Components

1. **Prometheus** - Metrics collection and storage
2. **Grafana** - Visualization and dashboards
3. **Node Exporter** - System-level metrics
4. **cAdvisor** - Container metrics
5. **AlertManager** - Alerting and notifications
6. **Custom Metrics Service** - Application-specific metrics

### Metrics Collected

#### HTTP Metrics
- Request count by method, route, and status code
- Request duration histograms
- Response size distribution

#### Application Metrics
- Contract operations (count and duration)
- Cognitive Lab registry size
- Active connections
- Cache hit rate
- Database connections
- Queue sizes
- Authentication attempts
- Blockchain sync status
- Gas usage distribution

#### System Metrics
- Memory usage (heap, RSS, external)
- CPU utilization
- System uptime
- Resource utilization

## Implementation Details

### Metrics Service (`src/services/metricsService.js`)

The `MetricsService` class provides a comprehensive metrics collection system:

```javascript
const MetricsService = require('./services/metricsService');
const metricsService = new MetricsService();

// Record HTTP request
metricsService.recordHttpRequest(method, route, statusCode, duration);

// Record contract operation
metricsService.recordContractOperation(operation, status, duration);

// Set system metrics
metricsService.collectSystemMetrics();
```

### Metrics Middleware (`src/middleware/metricsMiddleware.js`)

The middleware automatically tracks HTTP requests and responses:

```javascript
const MetricsMiddleware = require('./middleware/metricsMiddleware');
const metricsMiddleware = new MetricsMiddleware();

// Apply to Express app
app.use(metricsMiddleware.requestTracker());
app.use(metricsMiddleware.errorTracker());
app.get('/metrics', metricsMiddleware.metricsEndpoint());
app.get('/health', metricsMiddleware.healthWithMetrics());
```

## Setup and Deployment

### Prerequisites

- Docker and Docker Compose
- Node.js 16+
- Access to the Cognitive Lab Backend codebase

### Quick Start

1. **Start the monitoring stack:**
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

2. **Start the backend service:**
```bash
cd backend
npm install
npm start
```

3. **Access the dashboards:**
- Grafana: http://localhost:3000 (admin/stellar123)
- Prometheus: http://localhost:9090
- AlertManager: http://localhost:9093

### Docker Services

| Service | Port | Description |
|---------|------|-------------|
| prometheus | 9090 | Metrics collection and storage |
| grafana | 3000 | Visualization dashboards |
| node-exporter | 9100 | System metrics |
| cadvisor | 8080 | Container metrics |
| alertmanager | 9093 | Alerting |

## Monitoring Endpoints

### Backend Endpoints

- `GET /metrics` - Prometheus metrics endpoint
- `GET /health` - Health check with detailed metrics

### External Endpoints

- `http://localhost:9090/metrics` - Prometheus metrics
- `http://localhost:3000` - Grafana dashboard
- `http://localhost:8080/metrics` - cAdvisor container metrics

## Grafana Dashboard

The pre-configured Grafana dashboard includes the following panels:

1. **HTTP Request Rate** - Requests per second by method and route
2. **HTTP Request Duration** - Response time percentiles
3. **Contract Operations** - Blockchain operation metrics
4. **Active Connections** - Current active connections
5. **Cognitive Lab Registry Size** - Number of Cognitive Labs in registry
6. **Error Rate** - Error occurrences by type and endpoint
7. **Stellar Operations** - Stellar blockchain operations
8. **Cache Hit Rate** - Cache performance
9. **Memory Usage** - Memory consumption breakdown
10. **Database Connections** - Database connection pool
11. **API Response Size** - Response size distribution
12. **Authentication Attempts** - Authentication metrics
13. **Gas Usage Distribution** - Gas consumption patterns
14. **Queue Sizes** - Processing queue metrics
15. **Blockchain Sync Status** - Blockchain synchronization
16. **System Uptime** - Service uptime

## Alerting

### AlertManager Configuration

AlertManager is configured to send alerts via:
- Email notifications
- Webhook callbacks to the backend

### Alert Rules

Create alert rules in Prometheus (`monitoring/alert-rules.yml`):

```yaml
groups:
  - name: stellar-LABS-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(error_rate_total[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          
      - alert: HighMemoryUsage
        expr: resource_utilization{resource_type="memory_heap_used"} / resource_utilization{resource_type="memory_heap_total"} > 0.9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Memory usage above 90%"
```

## Custom Metrics Integration

### Adding New Metrics

1. **Define the metric in MetricsService:**
```javascript
this.customMetric = new client.Counter({
  name: 'custom_metric_total',
  help: 'Description of custom metric',
  labelNames: ['label1', 'label2'],
  registers: [this.register]
});
```

2. **Add a method to record the metric:**
```javascript
recordCustomMetric(label1, label2) {
  this.customMetric.inc({ label1, label2 });
}
```

3. **Use in your application code:**
```javascript
this.metricsService.recordCustomMetric(value1, value2);
```

### Business Metrics

Track business-specific metrics:
- Cognitive Lab creation rate
- Credential issuance volume
- Transaction success rates
- User activity patterns

## Performance Optimization

### Metrics Best Practices

1. **Use appropriate metric types:**
   - Counter for incrementing values
   - Gauge for current values
   - Histogram for distributions

2. **Label cardinality:**
   - Keep label values bounded
   - Avoid high-cardinality labels
   - Use consistent label naming

3. **Sampling:**
   - Configure appropriate scrape intervals
   - Balance between granularity and performance

4. **Retention:**
   - Set appropriate data retention periods
   - Consider remote storage for long-term data

## Troubleshooting

### Common Issues

1. **Metrics not appearing:**
   - Check if the backend is running
   - Verify the `/metrics` endpoint is accessible
   - Check Prometheus configuration

2. **High memory usage:**
   - Monitor metric cardinality
   - Check for label explosions
   - Review scrape intervals

3. **Dashboard not loading:**
   - Verify Grafana datasource configuration
   - Check Prometheus connectivity
   - Review dashboard JSON syntax

### Debug Commands

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check metrics endpoint
curl http://localhost:3001/metrics

# Check health endpoint
curl http://localhost:3001/health

# View container logs
docker-compose -f docker-compose.monitoring.yml logs prometheus
```

## Security Considerations

### Network Security

- Restrict access to monitoring endpoints
- Use firewall rules for internal monitoring
- Implement authentication for Grafana

### Data Protection

- Avoid sensitive data in metric labels
- Use secure communication channels
- Implement proper access controls

## Maintenance

### Regular Tasks

1. **Monitor monitoring system health**
2. **Update dashboards and alerts**
3. **Review metric retention policies**
4. **Backup Grafana configurations**

### Scaling Considerations

- Consider remote storage for large deployments
- Implement metric federation for multi-region setups
- Use load balancing for high availability

## Integration with CI/CD

### Monitoring as Code

- Version control all monitoring configurations
- Include monitoring setup in deployment pipelines
- Automated testing of monitoring endpoints

### Health Checks

```bash
# Add to CI pipeline
curl -f http://localhost:3001/health || exit 1
curl -f http://localhost:9090/-/healthy || exit 1
```

## Conclusion

This comprehensive monitoring implementation provides full visibility into the Cognitive Lab Backend performance, enabling proactive issue detection, performance optimization, and operational excellence.

For support or questions, refer to the project documentation or create an issue in the repository.

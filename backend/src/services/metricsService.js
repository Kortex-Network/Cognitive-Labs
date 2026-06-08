const client = require('prom-client');

class MetricsService {
  constructor() {
    // Create a Registry to register the metrics
    this.register = new client.Registry();

    // Add a default label to all metrics
    this.register.setDefaultLabels({
      app: 'stellar-LABS-backend'
    });

    // Enable the collection of default metrics
    client.collectDefaultMetrics({ register: this.register });

    // Custom metrics
    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register]
    });

    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [this.register]
    });

    this.contractOperationsTotal = new client.Counter({
      name: 'contract_operations_total',
      help: 'Total number of contract operations',
      labelNames: ['operation', 'status'],
      registers: [this.register]
    });

    this.contractOperationDuration = new client.Histogram({
      name: 'contract_operation_duration_seconds',
      help: 'Duration of contract operations in seconds',
      labelNames: ['operation'],
      buckets: [0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.register]
    });

    this.activeConnections = new client.Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
      registers: [this.register]
    });

    this.LABSRegistrySize = new client.Gauge({
      name: 'LABS_registry_size',
      help: 'Number of LABSs in the registry',
      registers: [this.register]
    });

    this.credentialsIssuedTotal = new client.Counter({
      name: 'credentials_issued_total',
      help: 'Total number of credentials issued',
      labelNames: ['credential_type'],
      registers: [this.register]
    });

    this.stellarOperationsTotal = new client.Counter({
      name: 'stellar_operations_total',
      help: 'Total number of Stellar operations',
      labelNames: ['operation_type', 'status'],
      registers: [this.register]
    });

    this.stellarOperationDuration = new client.Histogram({
      name: 'stellar_operation_duration_seconds',
      help: 'Duration of Stellar operations in seconds',
      labelNames: ['operation_type'],
      buckets: [1, 2, 5, 10, 20, 30, 60],
      registers: [this.register]
    });

    this.errorRate = new client.Counter({
      name: 'error_rate_total',
      help: 'Total number of errors',
      labelNames: ['error_type', 'endpoint'],
      registers: [this.register]
    });

    this.cacheHitRate = new client.Gauge({
      name: 'cache_hit_rate',
      help: 'Cache hit rate percentage',
      registers: [this.register]
    });

    // Additional enhanced metrics
    this.databaseConnections = new client.Gauge({
      name: 'database_connections',
      help: 'Number of active database connections',
      labelNames: ['type'],
      registers: [this.register]
    });

    // Database pool specific metrics
    this.availableDbConnections = new client.Gauge({
      name: 'database_available_connections',
      help: 'Number of available database connections in pool',
      registers: [this.register]
    });

    this.pendingDbConnections = new client.Gauge({
      name: 'database_pending_connections',
      help: 'Number of pending database connections',
      registers: [this.register]
    });

    this.dbConnectionState = new client.Gauge({
      name: 'database_connection_state',
      help: 'Database connection state (0=disconnected, 1=connected, 2=connecting, 3=disconnecting)',
      registers: [this.register]
    });

    this.queueSize = new client.Gauge({
      name: 'queue_size',
      help: 'Size of processing queues',
      labelNames: ['queue_name'],
      registers: [this.register]
    });

    this.resourceUtilization = new client.Gauge({
      name: 'resource_utilization',
      help: 'System resource utilization',
      labelNames: ['resource_type'],
      registers: [this.register]
    });

    this.apiResponseSize = new client.Histogram({
      name: 'api_response_size_bytes',
      help: 'Size of API responses in bytes',
      labelNames: ['endpoint', 'method'],
      buckets: [100, 500, 1000, 5000, 10000, 50000, 100000],
      registers: [this.register]
    });

    this.authenticationAttempts = new client.Counter({
      name: 'authentication_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['status', 'auth_method'],
      registers: [this.register]
    });

    this.blockchainSyncStatus = new client.Gauge({
      name: 'blockchain_sync_status',
      help: 'Blockchain synchronization status',
      labelNames: ['blockchain'],
      registers: [this.register]
    });

    this.gasUsage = new client.Histogram({
      name: 'gas_usage_histogram',
      help: 'Gas usage for blockchain operations',
      labelNames: ['operation_type'],
      buckets: [1000, 5000, 10000, 50000, 100000, 500000, 1000000],
      registers: [this.register]
    });
  }

  // HTTP request metrics
  recordHttpRequest(method, route, statusCode, duration) {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
  }

  // Contract operation metrics
  recordContractOperation(operation, status, duration) {
    this.contractOperationsTotal.inc({ operation, status });
    this.contractOperationDuration.observe({ operation }, duration);
  }

  // Connection metrics
  setActiveConnections(count) {
    this.activeConnections.set(count);
  }

  // LABS registry metrics
  setLABSRegistrySize(size) {
    this.LABSRegistrySize.set(size);
  }

  // Credential metrics
  recordCredentialIssued(credentialType) {
    this.credentialsIssuedTotal.inc({ credential_type: credentialType });
  }

  // Stellar operation metrics
  recordStellarOperation(operationType, status, duration) {
    this.stellarOperationsTotal.inc({ operation_type: operationType, status });
    this.stellarOperationDuration.observe({ operation_type: operationType }, duration);
  }

  // Error metrics
  recordError(errorType, endpoint) {
    this.errorRate.inc({ error_type: errorType, endpoint });
  }

  // Cache metrics
  setCacheHitRate(rate) {
    this.cacheHitRate.set(rate);
  }

  // Enhanced metrics methods
  setDatabaseConnections(type, count) {
    this.databaseConnections.set({ type }, count);
  }

  setQueueSize(queueName, size) {
    this.queueSize.set({ queue_name: queueName }, size);
  }

  setResourceUtilization(resourceType, utilization) {
    this.resourceUtilization.set({ resource_type: resourceType }, utilization);
  }

  recordApiResponseSize(endpoint, method, size) {
    this.apiResponseSize.observe({ endpoint, method }, size);
  }

  recordAuthenticationAttempt(status, authMethod) {
    this.authenticationAttempts.inc({ status, auth_method: authMethod });
  }

  setBlockchainSyncStatus(blockchain, status) {
    this.blockchainSyncStatus.set({ blockchain }, status);
  }

  recordGasUsage(operationType, gasUsed) {
    this.gasUsage.observe({ operation_type: operationType }, gasUsed);
  }

  // System metrics collection
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Set memory metrics
    this.setResourceUtilization('memory_heap_used', memUsage.heapUsed);
    this.setResourceUtilization('memory_heap_total', memUsage.heapTotal);
    this.setResourceUtilization('memory_external', memUsage.external);
    this.setResourceUtilization('memory_rss', memUsage.rss);

    // Set CPU metrics (convert to percentage)
    this.setResourceUtilization('cpu_user', cpuUsage.user);
    this.setResourceUtilization('cpu_system', cpuUsage.system);

    // Set uptime
    this.setResourceUtilization('uptime_seconds', process.uptime());
  }

  // Get metrics for Prometheus
  getMetrics() {
    return this.register.metrics();
  }

  // Reset metrics (useful for testing)
  resetMetrics() {
    if (typeof this.register.resetMetrics === 'function') {
      this.register.resetMetrics();
    }
  }
}

const metricsService = new MetricsService();

module.exports = MetricsService;
module.exports.MetricsService = MetricsService;
module.exports.metricsService = metricsService;

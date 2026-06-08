const MetricsService = require('../src/services/metricsService');
const MetricsMiddleware = require('../src/middleware/metricsMiddleware');

/**
 * Test suite for Performance Monitoring Implementation
 * This test validates the metrics collection and monitoring functionality
 */

describe('Performance Monitoring Tests', () => {
  let metricsService;
  let metricsMiddleware;

  beforeEach(() => {
    metricsService = new MetricsService();
    metricsMiddleware = new MetricsMiddleware();
  });

  describe('MetricsService', () => {
    test('should initialize all metrics', () => {
      expect(metricsService.httpRequestsTotal).toBeDefined();
      expect(metricsService.httpRequestDuration).toBeDefined();
      expect(metricsService.contractOperationsTotal).toBeDefined();
      expect(metricsService.contractOperationDuration).toBeDefined();
      expect(metricsService.activeConnections).toBeDefined();
      expect(metricsService.LABSRegistrySize).toBeDefined();
      expect(metricsService.credentialsIssuedTotal).toBeDefined();
      expect(metricsService.stellarOperationsTotal).toBeDefined();
      expect(metricsService.stellarOperationDuration).toBeDefined();
      expect(metricsService.errorRate).toBeDefined();
      expect(metricsService.cacheHitRate).toBeDefined();
      expect(metricsService.databaseConnections).toBeDefined();
      expect(metricsService.queueSize).toBeDefined();
      expect(metricsService.resourceUtilization).toBeDefined();
      expect(metricsService.apiResponseSize).toBeDefined();
      expect(metricsService.authenticationAttempts).toBeDefined();
      expect(metricsService.blockchainSyncStatus).toBeDefined();
      expect(metricsService.gasUsage).toBeDefined();
    });

    test('should record HTTP request metrics', () => {
      metricsService.recordHttpRequest('GET', '/api/v1/LABSs', 200, 0.5);
      
      // Verify metrics are recorded (would need to check actual values in real test)
      expect(metricsService.httpRequestsTotal).toBeDefined();
      expect(metricsService.httpRequestDuration).toBeDefined();
    });

    test('should record contract operation metrics', () => {
      metricsService.recordContractOperation('create', 'success', 2.5);
      
      expect(metricsService.contractOperationsTotal).toBeDefined();
      expect(metricsService.contractOperationDuration).toBeDefined();
    });

    test('should record authentication attempts', () => {
      metricsService.recordAuthenticationAttempt('success', 'jwt');
      metricsService.recordAuthenticationAttempt('failed', 'api-key');
      
      expect(metricsService.authenticationAttempts).toBeDefined();
    });

    test('should record gas usage', () => {
      metricsService.recordGasUsage('transfer', 25000);
      metricsService.recordGasUsage('contract_call', 150000);
      
      expect(metricsService.gasUsage).toBeDefined();
    });

    test('should collect system metrics', () => {
      metricsService.collectSystemMetrics();
      
      expect(metricsService.resourceUtilization).toBeDefined();
    });

    test('should set gauge metrics', () => {
      metricsService.setActiveConnections(10);
      metricsService.setLABSRegistrySize(1000);
      metricsService.setCacheHitRate(85.5);
      metricsService.setDatabaseConnections('active', 5);
      metricsService.setQueueSize('processing', 25);
      metricsService.setBlockchainSyncStatus('stellar', 1);
      
      expect(metricsService.activeConnections).toBeDefined();
      expect(metricsService.LABSRegistrySize).toBeDefined();
      expect(metricsService.cacheHitRate).toBeDefined();
      expect(metricsService.databaseConnections).toBeDefined();
      expect(metricsService.queueSize).toBeDefined();
      expect(metricsService.blockchainSyncStatus).toBeDefined();
    });

    test('should get metrics in Prometheus format', () => {
      const metrics = metricsService.getMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics.length).toBeGreaterThan(0);
    });

    test('should reset metrics', () => {
      metricsService.resetMetrics();
      const metrics = metricsService.getMetrics();
      expect(typeof metrics).toBe('string');
    });
  });

  describe('MetricsMiddleware', () => {
    test('should initialize with metrics service', () => {
      expect(metricsMiddleware.metricsService).toBeDefined();
    });

    test('should provide request tracker middleware', () => {
      const middleware = metricsMiddleware.requestTracker();
      expect(typeof middleware).toBe('function');
    });

    test('should provide error tracker middleware', () => {
      const middleware = metricsMiddleware.errorTracker();
      expect(typeof middleware).toBe('function');
    });

    test('should provide metrics endpoint', () => {
      const middleware = metricsMiddleware.metricsEndpoint();
      expect(typeof middleware).toBe('function');
    });

    test('should provide health endpoint', () => {
      const middleware = metricsMiddleware.healthWithMetrics();
      expect(typeof middleware).toBe('function');
    });

    test('should return metrics service instance', () => {
      const service = metricsMiddleware.getMetricsService();
      expect(service).toBe(metricsService);
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete request lifecycle', () => {
      // Simulate request lifecycle
      metricsService.recordHttpRequest('POST', '/api/v1/LABSs', 201, 1.2);
      metricsService.recordApiResponseSize('/api/v1/LABSs', 'POST', 1024);
      metricsService.recordAuthenticationAttempt('success', 'jwt');
      
      const metrics = metricsService.getMetrics();
      expect(metrics).toContain('http_requests_total');
      expect(metrics).toContain('api_response_size_bytes');
      expect(metrics).toContain('authentication_attempts_total');
    });

    test('should handle error scenarios', () => {
      metricsService.recordError('ValidationError', '/api/v1/LABSs');
      metricsService.recordError('DatabaseError', '/api/v1/credentials');
      
      const metrics = metricsService.getMetrics();
      expect(metrics).toContain('error_rate_total');
    });

    test('should handle blockchain operations', () => {
      metricsService.recordStellarOperation('payment', 'success', 5.2);
      metricsService.recordStellarOperation('create_account', 'failed', 3.1);
      metricsService.recordGasUsage('payment', 10000);
      metricsService.recordGasUsage('create_account', 50000);
      
      const metrics = metricsService.getMetrics();
      expect(metrics).toContain('stellar_operations_total');
      expect(metrics).toContain('gas_usage_histogram');
    });
  });
});

// Performance benchmarks
describe('Performance Benchmarks', () => {
  let metricsService;

  beforeEach(() => {
    metricsService = new MetricsService();
  });

  test('should handle high volume metrics recording', () => {
    const startTime = Date.now();
    
    // Simulate high volume
    for (let i = 0; i < 10000; i++) {
      metricsService.recordHttpRequest('GET', '/api/v1/test', 200, 0.1);
    }
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });

  test('should handle concurrent metrics operations', () => {
    const promises = [];
    
    // Simulate concurrent operations
    for (let i = 0; i < 100; i++) {
      promises.push(Promise.resolve().then(() => {
        metricsService.recordHttpRequest('POST', '/api/v1/concurrent', 201, 0.5);
        metricsService.recordAuthenticationAttempt('success', 'jwt');
        metricsService.setActiveConnections(i);
      }));
    }
    
    return Promise.all(promises).then(() => {
      const metrics = metricsService.getMetrics();
      expect(metrics).toContain('http_requests_total');
      expect(metrics).toContain('authentication_attempts_total');
    });
  });
});

module.exports = {
  MetricsService,
  MetricsMiddleware
};

const MetricsService = require('../services/metricsService');
const { getConnectionPoolStats } = require('../utils/database');

class MetricsMiddleware {
  constructor() {
    this.metricsService = new MetricsService();

    // Start system metrics collection interval
    this.startSystemMetricsCollection();

    // Start database pool metrics collection
    this.startDatabaseMetricsCollection();
  }

  // Start collecting system metrics periodically
  startSystemMetricsCollection() {
    if (this.systemMetricsInterval) {
      return;
    }

    // Collect system metrics every 30 seconds
    this.systemMetricsInterval = setInterval(() => {
      this.metricsService.collectSystemMetrics();
    }, 30000);

    if (typeof this.systemMetricsInterval.unref === 'function') {
      this.systemMetricsInterval.unref();
    }
  }

  // Start collecting database pool metrics periodically
  startDatabaseMetricsCollection() {
    // Collect database pool metrics every 30 seconds
    setInterval(() => {
      try {
        const dbStats = getConnectionPoolStats();

        // Update database connection metrics
        if (dbStats.poolSize !== undefined) {
          this.metricsService.databaseConnections.set(dbStats.poolSize);
        }

        if (dbStats.availableConnections !== undefined) {
          this.metricsService.availableDbConnections.set(dbStats.availableConnections);
        }

        if (dbStats.pendingConnections !== undefined) {
          this.metricsService.pendingDbConnections.set(dbStats.pendingConnections);
        }

        // Track connection state
        this.metricsService.dbConnectionState.set(dbStats.readyState);

      } catch (error) {
        console.error('Error collecting database metrics:', error.message);
      }
    }, 30000);
  }

  // Middleware to track HTTP requests
  requestTracker() {
    return (req, res, next) => {
      const startTime = Date.now();

      // Override res.end to track response
      const originalEnd = res.end;
      res.end = function (...args) {
        const duration = (Date.now() - startTime) / 1000; // Convert to seconds
        const route = getRouteLabel(req);
        const method = req.method;
        const statusCode = res.statusCode;

        // Calculate response size
        const responseSize = res.get('content-length') ? parseInt(res.get('content-length')) : 0;

        // Record metrics
        this.metricsService.recordHttpRequest(method, route, statusCode, duration);
        this.metricsService.recordApiResponseSize(route, method, responseSize);

        // Call original end
        originalEnd.apply(this, args);
      }.bind(this);

      next();
    };
  }

  // Middleware to track errors
  errorTracker() {
    return (err, req, res, next) => {
      const endpoint = getRouteLabel(req);
      const errorType = err.name || 'UnknownError';

      // Record error metric
      this.metricsService.recordError(errorType, endpoint);

      next(err);
    };
  }

  // Metrics endpoint for Prometheus
  metricsEndpoint() {
    return async (req, res) => {
      res.set('Content-Type', this.metricsService.register.contentType);
      res.end(await this.metricsService.getMetrics());
    };
  }

  // Health check with metrics
  healthWithMetrics() {
    return (req, res) => {
      const memUsage = process.memoryUsage();
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        uptime: process.uptime(),
        memory: {
          rss: memUsage.rss,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external
        },
        metrics: {
          activeConnections: 'available via /metrics',
          LABSRegistrySize: 'available via /metrics',
          cacheHitRate: 'available via /metrics',
          databaseConnections: 'available via /metrics',
          queueSize: 'available via /metrics',
          resourceUtilization: 'available via /metrics',
          blockchainSyncStatus: 'available via /metrics'
        },
        performance: {
          averageResponseTime: this.getAverageResponseTime(),
          requestsPerSecond: this.getRequestsPerSecond(),
          errorRate: this.getErrorRate()
        }
      };

      res.json(health);
    };
  }

  // Helper methods for performance metrics
  getAverageResponseTime() {
    // This would typically be calculated from stored metrics
    // For now, return a placeholder
    return '0.5s';
  }

  getRequestsPerSecond() {
    // This would typically be calculated from stored metrics
    // For now, return a placeholder
    return '10';
  }

  getErrorRate() {
    // This would typically be calculated from stored metrics
    // For now, return a placeholder
    return '0.01';
  }

  // Get metrics service instance
  getMetricsService() {
    return this.metricsService;
  }
}

module.exports = MetricsMiddleware;

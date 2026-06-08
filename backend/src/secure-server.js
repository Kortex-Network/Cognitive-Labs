const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { smartRateLimiter } = require("./middleware/rateLimiter");
require('dotenv').config();

// Initialize job queue workers
require('./workers');

const app = express();

// Initialize metrics middleware
// Temporarily disabled for testing
// const metricsMiddleware = new MetricsMiddleware();

// Request context must run before anything that logs
app.use(requestContextMiddleware);

// Metrics tracking middleware (must be before other middleware)
// app.use(metricsMiddleware.requestTracker());

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Redis-backed rate limiting with per-endpoint configuration
app.use('/api', smartRateLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API configuration endpoint (secure)
app.get('/api/config', (req, res) => {
  // Only expose non-sensitive configuration to frontend
  const publicConfig = {
    STELLAR_NETWORK: process.env.STELLAR_NETWORK,
    LABS_METHOD: process.env.LABS_METHOD,
    ENABLE_FREIGHTER: process.env.ENABLE_FREIGHTER !== 'false',
    ENABLE_ADVANCED_FEATURES: process.env.ENABLE_ADVANCED_FEATURES !== 'false',
  };

  res.json(publicConfig);
});

// Health check endpoint with metrics
// app.get('/health', metricsMiddleware.healthWithMetrics());
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database pool stats endpoint
app.get('/api/db-stats', (req, res) => {
  try {
    const stats = getConnectionPoolStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get database stats',
      message: error.message
    });
  }
});

// Prometheus metrics endpoint
// app.get('/metrics', metricsMiddleware.metricsEndpoint());

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use('/api', require('./routes'));

// Analytics routes (directly mounted for testing)
const analyticsService = require('./services/analyticsService');
app.get('/api/v1/analytics/dashboard', async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const validTimeRanges = ['7d', '30d', '90d', '1y'];
    if (!validTimeRanges.includes(timeRange)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timeRange. Must be one of: 7d, 30d, 90d, 1y'
      });
    }
    const analytics = await analyticsService.getDashboardAnalytics(timeRange);
    res.json({
      success: true,
      data: analytics,
      meta: {
        timeRange,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error tracking middleware
// app.use(metricsMiddleware.errorTracker());

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      userMessage: 'The requested resource was not found.',
      action: 'Verify the URL and try again.',
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    }
  });
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    console.log('HTTP server closed');

    // Close database connection
    await disconnectDatabase();

    console.log('Graceful shutdown completed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

const PORT = process.env.PORT || 3001;

// Start server and connect to database
const startServer = async () => {
  try {
    // Connect to database first
    await connectDatabase();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`CORS origin: ${process.env.FRONTEND_URL}`);
    });

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;

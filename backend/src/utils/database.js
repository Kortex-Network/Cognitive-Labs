const mongoose = require('mongoose');
const logger = require('./logger');

// Connection state tracking
let connectionRetries = 0;
const MAX_RETRIES = parseInt(process.env.DB_MAX_RETRIES || '5');
const RETRY_DELAY = parseInt(process.env.DB_RETRY_DELAY || '5000');

/**
 * Connects to MongoDB with connection pooling and retry logic
 * @param {number} retryCount - Current retry attempt number
 */
const connectDatabase = async (retryCount = 0) => {
  const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_URL || 'mongodb://localhost:27017/stellar-LABS';
  
  const options = {
    // Connection Pool Options for High Traffic
    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '50'),
    minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE || '10'),
    maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME || '30000'), // Close idle connections after 30s
    
    // Timeouts and keep-alive
    connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT || '30000'), // Give up after 30 seconds
    socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT || '45000'), // Close sockets after 45 seconds of inactivity
    
    // Connection Management
    family: 4, // Use IPv4
    heartbeatFrequencyMS: parseInt(process.env.DB_HEARTBEAT_FREQ || '10000'), // Check liveness every 10 seconds
    
    // Server monitoring
    serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT || '5000'),
    
    // Retry settings
    retryWrites: true,
    retryReads: true,
    
    // Auto indexing
    autoIndex: process.env.NODE_ENV !== 'production',
  };

  try {
    if (process.env.NODE_ENV === 'test') {
      logger.info('Running in test mode, skipping real DB connection');
      return;
    }

    logger.info(`Connecting to MongoDB with pool size [${options.minPoolSize}-${options.maxPoolSize}]...`);
    
    // Set up connection event listeners for better monitoring
    mongoose.connection.on('connected', () => {
      logger.info('Mongoose connected to DB Cluster');
      connectionRetries = 0; // Reset retry counter on successful connection
    });

    mongoose.connection.on('error', (err) => {
      logger.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Mongoose disconnected from DB Cluster');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('Mongoose reconnected to DB Cluster');
    });

    mongoose.connection.on('close', () => {
      logger.info('Mongoose connection closed');
    });

    // Actually connect (with a try-catch to avoid crashing entire app if DB is down initially)
    await mongoose.connect(mongoURI, options);
    
    logger.info('Database connected successfully');
    
    // Log connection pool stats after connection
    logConnectionPoolStats();
  } catch (error) {
    logger.error(`Database connection failed (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message);
    
    // Retry logic with exponential backoff
    if (retryCount < MAX_RETRIES) {
      connectionRetries = retryCount + 1;
      const delay = RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
      logger.info(`Retrying database connection in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return connectDatabase(connectionRetries);
    }
    
    // If all retries exhausted
    logger.error('All database connection retries exhausted');
    
    // If in production, we should probably fail hard
    if (process.env.NODE_ENV === 'production') {
      logger.error('Production database required. Exiting...');
      process.exit(1);
    } else {
      logger.warn('Non-production environment: continuing without real DB connection');
    }
  }
};

/**
 * Logs current connection pool statistics
 */
const logConnectionPoolStats = () => {
  if (mongoose.connection.readyState === 1) { // Connected
    const db = mongoose.connection.db;
    if (db) {
      db.admin().serverInfo().then(info => {
        logger.info(`MongoDB Server Info: ${info.version} - ${info.process}`);
      }).catch(err => {
        logger.warn('Could not fetch MongoDB server info:', err.message);
      });
    }
  }
};

/**
 * Gracefully closes database connection
 */
const disconnectDatabase = async () => {
  try {
    logger.info('Closing database connection...');
    await mongoose.connection.close();
    logger.info('Database connection closed successfully');
  } catch (error) {
    logger.error('Error closing database connection:', error.message);
  }
};

/**
 * Gets current connection pool statistics
 * @returns {object} Connection pool statistics
 */
const getConnectionPoolStats = () => {
  const stats = {
    readyState: mongoose.connection.readyState,
    readyStateName: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
    models: Object.keys(mongoose.connection.models).length,
  };
  
  // Add pool stats if available
  if (mongoose.connection.client) {
    const pool = mongoose.connection.client.topology?.s?.pool;
    if (pool) {
      stats.poolSize = pool.totalConnectionCount || 0;
      stats.availableConnections = pool.availableConnectionCount || 0;
      stats.pendingConnections = pool.pendingConnectionCount || 0;
    }
  }
  
  return stats;
};

module.exports = { 
  connectDatabase, 
  disconnectDatabase,
  getConnectionPoolStats,
  logConnectionPoolStats
};

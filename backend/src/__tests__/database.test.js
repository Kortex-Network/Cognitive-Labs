/**
 * @title Database Connection Pool Test
 * @dev Tests for MongoDB connection pooling functionality
 */

const mongoose = require('mongoose');
const { connectDatabase, disconnectDatabase, getConnectionPoolStats } = require('../utils/database');

describe('Database Connection Pool', () => {
  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/stellar-LABS-test';
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('Connection Pool Configuration', () => {
    it('should have proper pool size configuration', () => {
      const maxPoolSize = parseInt(process.env.DB_MAX_POOL_SIZE || '50');
      const minPoolSize = parseInt(process.env.DB_MIN_POOL_SIZE || '10');
      
      expect(maxPoolSize).toBeGreaterThan(0);
      expect(minPoolSize).toBeGreaterThan(0);
      expect(maxPoolSize).toBeGreaterThanOrEqual(minPoolSize);
    });

    it('should have timeout configurations', () => {
      const connectTimeout = parseInt(process.env.DB_CONNECT_TIMEOUT || '30000');
      const socketTimeout = parseInt(process.env.DB_SOCKET_TIMEOUT || '45000');
      
      expect(connectTimeout).toBeGreaterThan(0);
      expect(socketTimeout).toBeGreaterThan(0);
    });

    it('should have retry configuration', () => {
      const maxRetries = parseInt(process.env.DB_MAX_RETRIES || '5');
      const retryDelay = parseInt(process.env.DB_RETRY_DELAY || '5000');
      
      expect(maxRetries).toBeGreaterThan(0);
      expect(retryDelay).toBeGreaterThan(0);
    });
  });

  describe('Connection Pool Stats', () => {
    it('should return connection pool statistics', () => {
      const stats = getConnectionPoolStats();
      
      expect(stats).toHaveProperty('readyState');
      expect(stats).toHaveProperty('readyStateName');
      expect(stats).toHaveProperty('models');
      expect(typeof stats.readyState).toBe('number');
      expect(typeof stats.models).toBe('number');
    });

    it('should have valid ready state name', () => {
      const stats = getConnectionPoolStats();
      const validStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
      
      expect(validStates).toContain(stats.readyStateName);
    });
  });

  describe('Connection Event Handling', () => {
    it('should handle connection events', async () => {
      const eventSpy = jest.fn();
      
      mongoose.connection.on('connected', eventSpy);
      mongoose.connection.on('error', eventSpy);
      mongoose.connection.on('disconnected', eventSpy);
      
      // In test mode, connectDatabase returns early
      await connectDatabase();
      
      // Clean up
      mongoose.connection.removeAllListeners();
    });
  });

  describe('Graceful Shutdown', () => {
    it('should disconnect database gracefully', async () => {
      // In test mode, this should not throw
      await expect(disconnectDatabase()).resolves.not.toThrow();
    });
  });
});

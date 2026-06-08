const redis = require('redis');
const dotenv = require('dotenv');

dotenv.config();

class CacheService {
  constructor() {
    this.client = null;
    this.enabled = false;
    this.defaultTTL = Number(process.env.CACHE_TTL_SECONDS || process.env.LABS_CACHE_TTL || 300);
    this.connecting = this.connect();
  }

  async connect() {
    if (this.client || this.enabled) {
      return;
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.warn('Redis cache disabled: REDIS_URL not configured.');
      return;
    }

    try {
      this.client = redis.createClient({ url: redisUrl });
      this.client.on('error', (error) => {
        console.error('Redis client error:', error.message || error);
      });
      await this.client.connect();
      this.enabled = true;
      console.log('Redis cache connected');
    } catch (error) {
      console.error('Failed to connect to Redis cache:', error.message || error);
      this.client = null;
      this.enabled = false;
    }
  }

  async get(key) {
    if (!this.enabled) {
      await this.connecting;
      if (!this.enabled) return null;
    }

    try {
      return await this.client.get(key);
    } catch (error) {
      console.warn(`Redis GET failed for key ${key}: ${error.message || error}`);
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    if (!this.enabled) {
      await this.connecting;
      if (!this.enabled) return false;
    }

    try {
      await this.client.set(key, value, {
        EX: ttl
      });
      return true;
    } catch (error) {
      console.warn(`Redis SET failed for key ${key}: ${error.message || error}`);
      return false;
    }
  }

  async del(key) {
    if (!this.enabled) {
      await this.connecting;
      if (!this.enabled) return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.warn(`Redis DEL failed for key ${key}: ${error.message || error}`);
      return false;
    }
  }
}

module.exports = new CacheService();

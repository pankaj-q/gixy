import Redis from 'ioredis';
import config from './index.js';

let redisClient = null;

export function getRedisClient() {
  if (!redisClient && config.redis?.url) {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
    });

    redisClient.on('close', () => {
      console.log('📤 Redis connection closed');
    });
  }
  return redisClient;
}

export async function connectRedis() {
  const client = getRedisClient();
  if (client) {
    try {
      console.log('🔍 Attempting Redis connection...');
      await client.connect();
      console.log('✅ Redis connected successfully');
      return client;
    } catch (err) {
      console.warn('⚠️ Redis connection failed - continuing without cache', { error: err.message });
      return null;
    }
  }
  console.log('ℹ️ Redis not configured (no REDIS_URL)');
  return null;
}

export async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

// Cache helper functions
export const cache = {
  async get(key) {
    const client = getRedisClient();
    if (!client) return null;
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },

  async set(key, value, ttlSeconds = 300) {
    const client = getRedisClient();
    if (!client) return false;
    try {
      await client.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  async del(key) {
    const client = getRedisClient();
    if (!client) return false;
    try {
      await client.del(key);
      return true;
    } catch {
      return false;
    }
  },

  async delPattern(pattern) {
    const client = getRedisClient();
    if (!client) return false;
    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
      return true;
    } catch {
      return false;
    }
  }
};

export { redisClient };
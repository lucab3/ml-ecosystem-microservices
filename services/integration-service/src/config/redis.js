const redis = require('redis');
const logger = require('../utils/logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const redisConfig = {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 5000,
          lazyConnect: true,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('❌ Redis: Máximo de reintentos alcanzado');
              return false;
            }
            const delay = Math.min(retries * 50, 500);
            logger.warn(`🔄 Redis: Reintentando conexión en ${delay}ms (intento ${retries})`);
            return delay;
          }
        },
        database: process.env.REDIS_DB || 1 // DB 1 para integration service
      };

      this.client = redis.createClient(redisConfig);

      // Event listeners
      this.client.on('connect', () => {
        logger.info('🔗 Redis: Conectando...');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        logger.info('✅ Redis: Conexión lista (Integration Service)');
      });

      this.client.on('end', () => {
        this.isConnected = false;
        logger.info('🔌 Redis: Conexión cerrada');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        logger.error('❌ Redis error:', error);
      });

      this.client.on('reconnecting', () => {
        logger.info('🔄 Redis: Reconectando...');
      });

      await this.client.connect();
      
      // Test de conexión
      await this.client.ping();
      logger.info('🏓 Redis ping exitoso (Integration Service)');

    } catch (error) {
      this.isConnected = false;
      logger.error('❌ Error conectando a Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('👋 Redis desconectado (Integration Service)');
    }
  }

  // =================== CACHE METHODS ===================
  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`❌ Redis GET error for key ${key}:`, error);
      return null; // Fail gracefully
    }
  }

  async set(key, value, ttlSeconds = 3600) {
    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttlSeconds, serialized);
      return true;
    } catch (error) {
      logger.error(`❌ Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  async del(key) {
    try {
      const result = await this.client.del(key);
      return result === 1;
    } catch (error) {
      logger.error(`❌ Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key) {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`❌ Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  // =================== ML API CACHE ===================
  async cacheMLResponse(endpoint, data, ttlSeconds = 300) {
    const key = `ml_api:${endpoint}`;
    return await this.set(key, data, ttlSeconds);
  }

  async getCachedMLResponse(endpoint) {
    const key = `ml_api:${endpoint}`;
    return await this.get(key);
  }

  async invalidateMLCache(pattern = 'ml_api:*') {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info(`🗑️ Invalidated ${keys.length} ML API cache entries`);
      }
      return keys.length;
    } catch (error) {
      logger.error('❌ Error invalidating ML cache:', error);
      return 0;
    }
  }

  // =================== RATE LIMITING ===================
  async checkRateLimit(identifier, windowSeconds = 60, limit = 100) {
    const key = `rate_limit:ml_api:${identifier}`;
    
    try {
      const multi = this.client.multi();
      multi.incr(key);
      multi.expire(key, windowSeconds);
      const results = await multi.exec();
      
      const count = results[0];
      const remaining = Math.max(0, limit - count);
      const resetTime = Date.now() + (windowSeconds * 1000);
      
      return {
        allowed: count <= limit,
        count: count,
        remaining: remaining,
        resetTime: resetTime,
        window: windowSeconds
      };
    } catch (error) {
      logger.error(`❌ Redis rate limit error for ${identifier}:`, error);
      // Fail open - permitir requests si Redis falla
      return {
        allowed: true,
        count: 0,
        remaining: limit,
        resetTime: Date.now() + (windowSeconds * 1000),
        window: windowSeconds,
        error: true
      };
    }
  }

  async recordRateLimit(identifier, windowSeconds = 60) {
    const key = `rate_limit:ml_api:${identifier}`;
    
    try {
      const multi = this.client.multi();
      multi.incr(key);
      multi.expire(key, windowSeconds);
      await multi.exec();
      return true;
    } catch (error) {
      logger.error(`❌ Error recording rate limit for ${identifier}:`, error);
      return false;
    }
  }

  // =================== CIRCUIT BREAKER STATE ===================
  async setCircuitBreakerState(serviceName, state, ttlSeconds = 300) {
    const key = `circuit_breaker:${serviceName}`;
    return await this.set(key, state, ttlSeconds);
  }

  async getCircuitBreakerState(serviceName) {
    const key = `circuit_breaker:${serviceName}`;
    return await this.get(key);
  }

  // =================== USER TOKENS CACHE ===================
  async cacheUserTokens(userId, tokens, ttlSeconds = 3600) {
    const key = `user_tokens:${userId}`;
    return await this.set(key, tokens, ttlSeconds);
  }

  async getUserTokens(userId) {
    const key = `user_tokens:${userId}`;
    return await this.get(key);
  }

  async invalidateUserTokens(userId) {
    const key = `user_tokens:${userId}`;
    return await this.del(key);
  }

  // =================== HEALTH CHECK ===================
  async healthCheck() {
    try {
      const start = Date.now();
      await this.client.ping();
      const responseTime = Date.now() - start;
      
      return {
        status: 'healthy',
        connected: this.isConnected,
        response_time: `${responseTime}ms`,
        database: process.env.REDIS_DB || 1
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message,
        database: process.env.REDIS_DB || 1
      };
    }
  }

  // =================== STATS ===================
  async getStats() {
    try {
      const info = await this.client.info();
      const memory = await this.client.info('memory');
      
      return {
        connected_clients: this.extractInfoValue(info, 'connected_clients'),
        used_memory_human: this.extractInfoValue(memory, 'used_memory_human'),
        keyspace_hits: this.extractInfoValue(info, 'keyspace_hits'),
        keyspace_misses: this.extractInfoValue(info, 'keyspace_misses'),
        service: 'integration-service'
      };
    } catch (error) {
      logger.error('❌ Error obteniendo stats de Redis:', error);
      return null;
    }
  }

  extractInfoValue(info, key) {
    const line = info.split('\n').find(line => line.startsWith(key + ':'));
    return line ? line.split(':')[1].trim() : 'N/A';
  }
}

// Singleton
const redisClient = new RedisClient();

module.exports = redisClient;
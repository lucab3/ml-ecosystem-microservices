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
        database: process.env.REDIS_DB || 0
      };

      this.client = redis.createClient(redisConfig);

      // Event listeners
      this.client.on('connect', () => {
        logger.info('🔗 Redis: Conectando...');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        logger.info('✅ Redis: Conexión lista');
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
      logger.info('🏓 Redis ping exitoso');

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
      logger.info('👋 Redis desconectado');
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

  // =================== SESSION METHODS ===================
  async setSession(sessionId, userData, ttlSeconds = 21600) { // 6 horas default
    const key = `session:${sessionId}`;
    return await this.set(key, userData, ttlSeconds);
  }

  async getSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.get(key);
  }

  async deleteSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.del(key);
  }

  // =================== TOKEN BLACKLIST ===================
  async blacklistToken(token, ttlSeconds = 86400) { // 24 horas default
    const key = `blacklist:${token}`;
    return await this.set(key, { blacklisted: true }, ttlSeconds);
  }

  async isTokenBlacklisted(token) {
    const key = `blacklist:${token}`;
    return await this.exists(key);
  }

  // =================== RATE LIMITING ===================
  async incrementRateLimit(identifier, windowSeconds = 900, limit = 100) { // 15 min, 100 requests
    const key = `rate_limit:${identifier}`;
    
    try {
      const multi = this.client.multi();
      multi.incr(key);
      multi.expire(key, windowSeconds);
      const results = await multi.exec();
      
      const count = results[0];
      return {
        count: count,
        remaining: Math.max(0, limit - count),
        resetTime: Date.now() + (windowSeconds * 1000),
        limited: count > limit
      };
    } catch (error) {
      logger.error(`❌ Redis rate limit error for ${identifier}:`, error);
      // Fail open - no limitamos si Redis falla
      return {
        count: 0,
        remaining: limit,
        resetTime: Date.now() + (windowSeconds * 1000),
        limited: false
      };
    }
  }

  // =================== OAUTH STATE ===================
  async setOAuthState(state, data, ttlSeconds = 600) { // 10 minutos
    const key = `oauth_state:${state}`;
    return await this.set(key, data, ttlSeconds);
  }

  async getOAuthState(state) {
    const key = `oauth_state:${state}`;
    const data = await this.get(key);
    if (data) {
      await this.del(key); // One-time use
    }
    return data;
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
        response_time: `${responseTime}ms`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message
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
        keyspace_misses: this.extractInfoValue(info, 'keyspace_misses')
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
const redis = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Rate Limiter especializado para ML API
 * Maneja los límites específicos de MercadoLibre:
 * - 10,000 requests por hora por aplicación
 * - Límites por usuario basados en tokens
 */
class MLRateLimiter {
  constructor() {
    // Configuración basada en límites de ML
    this.globalLimit = {
      requests: 10000,      // 10k requests por hora por app
      windowMs: 3600000     // 1 hora
    };
    
    this.userLimit = {
      requests: 1000,       // 1k requests por hora por usuario
      windowMs: 3600000     // 1 hora
    };
    
    this.burstLimit = {
      requests: 100,        // 100 requests por minuto (burst protection)
      windowMs: 60000       // 1 minuto
    };
  }

  /**
   * Verifica si se puede hacer una request
   */
  async checkRateLimit(identifier = 'global') {
    try {
      // Verificar límite global de la aplicación
      const globalOk = await this.checkLimit('global', this.globalLimit);
      if (!globalOk.allowed) {
        logger.warn('Global rate limit exceeded', globalOk);
        return false;
      }

      // Verificar límite por usuario si no es global
      if (identifier !== 'global') {
        const userOk = await this.checkLimit(`user:${identifier}`, this.userLimit);
        if (!userOk.allowed) {
          logger.warn('User rate limit exceeded', { identifier, ...userOk });
          return false;
        }

        // Verificar límite de burst por usuario
        const burstOk = await this.checkLimit(`burst:${identifier}`, this.burstLimit);
        if (!burstOk.allowed) {
          logger.warn('User burst limit exceeded', { identifier, ...burstOk });
          return false;
        }
      }

      return true;

    } catch (error) {
      logger.error('Error checking rate limit:', error);
      // En caso de error, permitir la request (fail open)
      return true;
    }
  }

  /**
   * Registra una request exitosa
   */
  async recordRequest(identifier = 'global') {
    try {
      // Incrementar contador global
      await this.incrementCounter('global', this.globalLimit.windowMs);

      // Incrementar contadores por usuario si no es global
      if (identifier !== 'global') {
        await this.incrementCounter(`user:${identifier}`, this.userLimit.windowMs);
        await this.incrementCounter(`burst:${identifier}`, this.burstLimit.windowMs);
      }

    } catch (error) {
      logger.error('Error recording request:', error);
    }
  }

  /**
   * Maneja rate limit de ML (429)
   */
  async handleRateLimit(identifier = 'global') {
    try {
      const penaltyKey = `penalty:${identifier}`;
      const penaltyDuration = 300; // 5 minutos de penalización
      
      await redis.set(penaltyKey, { 
        penalized: true, 
        reason: 'ML_429_RESPONSE',
        timestamp: Date.now() 
      }, penaltyDuration);

      logger.error('Rate limit penalty applied', { 
        identifier, 
        duration: penaltyDuration 
      });

    } catch (error) {
      logger.error('Error applying rate limit penalty:', error);
    }
  }

  /**
   * Verifica un límite específico
   */
  async checkLimit(key, limit) {
    try {
      // Verificar si hay penalización activa
      const penaltyKey = `penalty:${key}`;
      const penalty = await redis.get(penaltyKey);
      if (penalty) {
        return {
          allowed: false,
          reason: 'PENALIZED',
          resetTime: Date.now() + 300000 // 5 minutos
        };
      }

      const current = await this.getCurrentCount(key);
      const allowed = current < limit.requests;

      return {
        allowed,
        current,
        limit: limit.requests,
        resetTime: Date.now() + limit.windowMs,
        remaining: Math.max(0, limit.requests - current)
      };

    } catch (error) {
      logger.error('Error checking specific limit:', error);
      return { allowed: true, current: 0, limit: limit.requests };
    }
  }

  /**
   * Incrementa contador con ventana deslizante
   */
  async incrementCounter(key, windowMs) {
    try {
      const now = Date.now();
      const window = Math.floor(now / windowMs);
      const counterKey = `rate_limit:${key}:${window}`;

      await redis.client.multi()
        .incr(counterKey)
        .expire(counterKey, Math.ceil(windowMs / 1000))
        .exec();

    } catch (error) {
      logger.error('Error incrementing counter:', error);
    }
  }

  /**
   * Obtiene el conteo actual para una ventana
   */
  async getCurrentCount(key) {
    try {
      const now = Date.now();
      const window = Math.floor(now / this.globalLimit.windowMs);
      const counterKey = `rate_limit:${key}:${window}`;
      
      const count = await redis.get(counterKey);
      return count || 0;

    } catch (error) {
      logger.error('Error getting current count:', error);
      return 0;
    }
  }

  /**
   * Obtiene estadísticas de rate limiting
   */
  async getStats() {
    try {
      const global = await this.checkLimit('global', this.globalLimit);
      
      return {
        global: {
          current: global.current,
          limit: global.limit,
          remaining: global.remaining,
          resetTime: global.resetTime,
          utilizationPercent: Math.round((global.current / global.limit) * 100)
        },
        limits: {
          globalPerHour: this.globalLimit.requests,
          userPerHour: this.userLimit.requests,
          burstPerMinute: this.burstLimit.requests
        },
        health: global.allowed ? 'healthy' : 'rate_limited'
      };

    } catch (error) {
      logger.error('Error getting rate limit stats:', error);
      return {
        global: { current: 0, limit: this.globalLimit.requests },
        health: 'unknown'
      };
    }
  }

  /**
   * Obtiene estadísticas por usuario
   */
  async getUserStats(identifier) {
    try {
      const user = await this.checkLimit(`user:${identifier}`, this.userLimit);
      const burst = await this.checkLimit(`burst:${identifier}`, this.burstLimit);
      
      return {
        user: {
          current: user.current,
          limit: user.limit,
          remaining: user.remaining,
          utilizationPercent: Math.round((user.current / user.limit) * 100)
        },
        burst: {
          current: burst.current,
          limit: burst.limit,
          remaining: burst.remaining
        },
        health: user.allowed && burst.allowed ? 'healthy' : 'rate_limited'
      };

    } catch (error) {
      logger.error('Error getting user rate limit stats:', error);
      return { health: 'unknown' };
    }
  }

  /**
   * Reset de contadores (para testing/admin)
   */
  async resetCounters(identifier = null) {
    try {
      if (identifier) {
        // Reset contadores específicos de un usuario
        const pattern = `rate_limit:*${identifier}:*`;
        // Nota: En producción usar SCAN en lugar de KEYS
        const keys = await redis.client.keys(pattern);
        if (keys.length > 0) {
          await redis.client.del(...keys);
        }
        logger.info('User rate limit counters reset', { identifier });
      } else {
        // Reset todos los contadores (usar con cuidado)
        const pattern = 'rate_limit:*';
        const keys = await redis.client.keys(pattern);
        if (keys.length > 0) {
          await redis.client.del(...keys);
        }
        logger.info('All rate limit counters reset');
      }

    } catch (error) {
      logger.error('Error resetting counters:', error);
    }
  }

  /**
   * Predicción de disponibilidad
   */
  async predictAvailability(identifier = 'global') {
    try {
      const stats = identifier === 'global' ? 
        await this.getStats() : 
        await this.getUserStats(identifier);

      const utilizationPercent = identifier === 'global' ? 
        stats.global.utilizationPercent : 
        stats.user.utilizationPercent;

      if (utilizationPercent < 50) {
        return { status: 'green', availability: 'high' };
      } else if (utilizationPercent < 80) {
        return { status: 'yellow', availability: 'medium' };
      } else {
        return { status: 'red', availability: 'low' };
      }

    } catch (error) {
      logger.error('Error predicting availability:', error);
      return { status: 'unknown', availability: 'unknown' };
    }
  }
}

// Singleton instance
const mlRateLimiter = new MLRateLimiter();

module.exports = mlRateLimiter;
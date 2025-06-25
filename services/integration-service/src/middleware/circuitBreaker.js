const logger = require('../utils/logger');
const redis = require('../config/redis');

/**
 * Circuit Breaker Pattern Implementation
 * Protege contra cascading failures cuando ML API está caída
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 30000; // 30 segundos
    this.monitoringPeriod = options.monitoringPeriod || 60000; // 1 minuto
    this.halfOpenMaxCalls = options.halfOpenMaxCalls || 3;
    
    this.states = {
      CLOSED: 'CLOSED',     // Funcionando normal
      OPEN: 'OPEN',         // Circuito abierto, rechazando requests
      HALF_OPEN: 'HALF_OPEN' // Probando si el servicio se recuperó
    };
    
    this.currentState = this.states.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.halfOpenCalls = 0;
  }

  async getState() {
    const stateData = await redis.get('circuit_breaker:ml_api');
    if (stateData) {
      this.currentState = stateData.state;
      this.failureCount = stateData.failureCount;
      this.lastFailureTime = stateData.lastFailureTime;
      this.halfOpenCalls = stateData.halfOpenCalls || 0;
    }
    return this.currentState;
  }

  async setState(state, data = {}) {
    this.currentState = state;
    
    const stateData = {
      state: this.currentState,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      halfOpenCalls: this.halfOpenCalls,
      timestamp: Date.now(),
      ...data
    };

    await redis.set('circuit_breaker:ml_api', stateData, 300); // TTL 5 minutos
  }

  async canExecute() {
    const currentState = await this.getState();
    const now = Date.now();

    switch (currentState) {
      case this.states.CLOSED:
        return true;

      case this.states.OPEN:
        // Verificar si es tiempo de intentar recovery
        if (this.lastFailureTime && 
            (now - this.lastFailureTime) >= this.recoveryTimeout) {
          await this.transitionToHalfOpen();
          return true;
        }
        return false;

      case this.states.HALF_OPEN:
        // Permitir un número limitado de calls para probar
        return this.halfOpenCalls < this.halfOpenMaxCalls;

      default:
        return true;
    }
  }

  async onSuccess() {
    const currentState = await this.getState();

    if (currentState === this.states.HALF_OPEN) {
      this.halfOpenCalls++;
      
      if (this.halfOpenCalls >= this.halfOpenMaxCalls) {
        // Suficientes calls exitosos, cerrar circuito
        await this.transitionToClosed();
        logger.info('Circuit breaker: ML API recovered, circuit closed');
      } else {
        await this.setState(this.states.HALF_OPEN);
      }
    } else if (currentState === this.states.CLOSED) {
      // Reset failure count en estado normal
      if (this.failureCount > 0) {
        this.failureCount = 0;
        await this.setState(this.states.CLOSED);
      }
    }
  }

  async onFailure(error) {
    const currentState = await this.getState();
    const now = Date.now();

    this.failureCount++;
    this.lastFailureTime = now;

    logger.error('Circuit breaker: ML API failure recorded', {
      error: error.message,
      failureCount: this.failureCount,
      state: currentState
    });

    if (currentState === this.states.HALF_OPEN) {
      // Failure durante half-open, volver a open
      await this.transitionToOpen();
      logger.warn('Circuit breaker: ML API still failing, reopening circuit');
    } else if (currentState === this.states.CLOSED && 
               this.failureCount >= this.failureThreshold) {
      // Muchos failures, abrir circuito
      await this.transitionToOpen();
      logger.error('Circuit breaker: ML API failure threshold reached, opening circuit');
    } else {
      await this.setState(currentState);
    }
  }

  async transitionToClosed() {
    this.failureCount = 0;
    this.halfOpenCalls = 0;
    this.lastFailureTime = null;
    await this.setState(this.states.CLOSED);
  }

  async transitionToOpen() {
    this.halfOpenCalls = 0;
    await this.setState(this.states.OPEN);
  }

  async transitionToHalfOpen() {
    this.halfOpenCalls = 0;
    await this.setState(this.states.HALF_OPEN);
    logger.info('Circuit breaker: Transitioning to half-open, testing ML API recovery');
  }

  async getStats() {
    const currentState = await this.getState();
    const stateData = await redis.get('circuit_breaker:ml_api') || {};
    
    return {
      state: currentState,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      lastFailureTime: this.lastFailureTime,
      recoveryTimeout: this.recoveryTimeout,
      halfOpenCalls: this.halfOpenCalls,
      halfOpenMaxCalls: this.halfOpenMaxCalls,
      uptime: stateData.timestamp ? Date.now() - stateData.timestamp : 0
    };
  }
}

// Singleton instance
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,      // 5 failures antes de abrir
  recoveryTimeout: 30000,   // 30 segundos antes de probar recovery
  halfOpenMaxCalls: 3       // 3 calls exitosos para cerrar
});

/**
 * Middleware para Express que implementa circuit breaker
 */
const circuitBreakerMiddleware = async (req, res, next) => {
  try {
    const canExecute = await circuitBreaker.canExecute();
    
    if (!canExecute) {
      const stats = await circuitBreaker.getStats();
      
      logger.warn('Circuit breaker: Request rejected', {
        path: req.path,
        method: req.method,
        state: stats.state,
        failureCount: stats.failureCount
      });

      return res.status(503).json({
        error: 'Service Temporarily Unavailable',
        message: 'MercadoLibre API is currently unavailable',
        circuit_breaker: {
          state: stats.state,
          retry_after: Math.ceil(stats.recoveryTimeout / 1000)
        },
        service: 'integration-service'
      });
    }

    // Interceptar respuesta para registrar success/failure
    const originalSend = res.send;
    const originalJson = res.json;

    const handleResponse = (statusCode) => {
      if (statusCode >= 200 && statusCode < 400) {
        // Success
        circuitBreaker.onSuccess().catch(error => {
          logger.error('Error recording circuit breaker success:', error);
        });
      } else if (statusCode >= 500) {
        // Server error - contar como failure del upstream service
        const error = new Error(`HTTP ${statusCode}`);
        circuitBreaker.onFailure(error).catch(err => {
          logger.error('Error recording circuit breaker failure:', err);
        });
      }
      // 4xx no se consideran failures del upstream service
    };

    res.send = function(body) {
      handleResponse(this.statusCode);
      return originalSend.call(this, body);
    };

    res.json = function(body) {
      handleResponse(this.statusCode);
      return originalJson.call(this, body);
    };

    // Manejar errores en el request
    const originalNext = next;
    next = (error) => {
      if (error) {
        // Error durante el request - contar como failure
        circuitBreaker.onFailure(error).catch(err => {
          logger.error('Error recording circuit breaker failure:', err);
        });
      }
      return originalNext(error);
    };

    next();

  } catch (error) {
    logger.error('Error in circuit breaker middleware:', error);
    // En caso de error del circuit breaker, permitir el request (fail open)
    next();
  }
};

module.exports = {
  circuitBreaker,
  circuitBreakerMiddleware
};
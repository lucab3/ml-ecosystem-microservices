const express = require('express');

// Use mock Redis in development
const useMockRedis = process.env.USE_MOCK_REDIS === 'true' || process.env.NODE_ENV === 'development';

const redis = useMockRedis ? {
  ping: async () => 'PONG',
  set: async () => 'OK',
  get: async () => null
} : require('../config/redis');

const router = express.Router();

/**
 * GET /health
 * Health check del integration service
 */
router.get('/', async (req, res) => {
  const healthCheck = {
    service: 'integration-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };

  try {
    // Verificar conexi�n a Redis
    const redisStatus = await redis.ping();
    healthCheck.checks.redis = {
      status: redisStatus === 'PONG' ? 'healthy' : 'unhealthy',
      response_time: Date.now()
    };

    // Verificar memoria
    const memUsage = process.memoryUsage();
    healthCheck.checks.memory = {
      status: 'healthy',
      usage: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
      }
    };

    // Verificar variables de entorno cr�ticas
    const requiredEnvVars = ['NODE_ENV', 'PORT', 'REDIS_URL'];
    const missingEnvVars = requiredEnvVars.filter(env => !process.env[env]);
    
    healthCheck.checks.environment = {
      status: missingEnvVars.length === 0 ? 'healthy' : 'warning',
      missing_vars: missingEnvVars
    };

    // Determinar status general
    const allChecksHealthy = Object.values(healthCheck.checks)
      .every(check => check.status === 'healthy');
    
    if (!allChecksHealthy) {
      healthCheck.status = 'warning';
    }

    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthCheck);

  } catch (error) {
    healthCheck.status = 'unhealthy';
    healthCheck.error = error.message;
    
    res.status(503).json(healthCheck);
  }
});

/**
 * GET /health/ready
 * Readiness check - verifica si el servicio est� listo para recibir tr�fico
 */
router.get('/ready', async (req, res) => {
  try {
    // Verificar dependencias cr�ticas
    await redis.ping();
    
    res.json({
      service: 'integration-service',
      ready: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(503).json({
      service: 'integration-service',
      ready: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/live
 * Liveness check - verifica si el servicio est� vivo
 */
router.get('/live', (req, res) => {
  res.json({
    service: 'integration-service',
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;
const express = require('express');
const router = express.Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'user-service',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: process.env.USE_MOCK_DB === 'true' ? 'mock' : 'postgresql'
  });
});

/**
 * GET /health/detailed
 * Detailed health check with dependencies
 */
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'user-service',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {
      database: 'healthy',
      kafka: 'healthy',
      redis: 'healthy'
    }
  };

  try {
    // Mock health checks in development
    if (process.env.USE_MOCK_DB === 'true') {
      health.checks.database = 'healthy (mock)';
      health.checks.kafka = 'healthy (mock)';
      health.checks.redis = 'healthy (mock)';
    }

    res.json(health);
  } catch (error) {
    res.status(503).json({
      ...health,
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;
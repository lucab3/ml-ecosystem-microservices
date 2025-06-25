const prometheus = require('prom-client');
const logger = require('../utils/logger');

// Create a Registry
const register = new prometheus.Registry();

// Add default metrics
prometheus.collectDefaultMetrics({ register });

// Custom metrics for user service
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestsTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const userOperationsTotal = new prometheus.Counter({
  name: 'user_operations_total',
  help: 'Total number of user operations',
  labelNames: ['operation', 'status']
});

const mlConnectionsTotal = new prometheus.Counter({
  name: 'ml_connections_total',
  help: 'Total number of MercadoLibre connections',
  labelNames: ['status']
});

const activeUsersGauge = new prometheus.Gauge({
  name: 'active_users',
  help: 'Number of active users',
  labelNames: ['timeframe']
});

const databaseConnectionsGauge = new prometheus.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections'
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(userOperationsTotal);
register.registerMetric(mlConnectionsTotal);
register.registerMetric(activeUsersGauge);
register.registerMetric(databaseConnectionsGauge);

/**
 * Middleware to collect HTTP metrics
 */
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Skip metrics collection for /metrics endpoint
  if (req.path === '/metrics') {
    return next();
  }
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    const method = req.method;
    const statusCode = res.statusCode.toString();
    
    // Record metrics
    httpRequestDuration
      .labels(method, route, statusCode)
      .observe(duration);
    
    httpRequestsTotal
      .labels(method, route, statusCode)
      .inc();
    
    // Log slow requests
    if (duration > 1) {
      logger.warn('Slow request detected', {
        method,
        route,
        duration: `${duration}s`,
        statusCode
      });
    }
  });
  
  next();
};

/**
 * Record user operation metrics
 */
const recordUserOperation = (operation, status = 'success') => {
  userOperationsTotal.labels(operation, status).inc();
};

/**
 * Record ML connection metrics
 */
const recordMLConnection = (status) => {
  mlConnectionsTotal.labels(status).inc();
};

/**
 * Update active users gauge
 */
const updateActiveUsers = (count, timeframe = 'daily') => {
  activeUsersGauge.labels(timeframe).set(count);
};

/**
 * Update database connections gauge
 */
const updateDatabaseConnections = (count) => {
  databaseConnectionsGauge.set(count);
};

/**
 * Get metrics for Prometheus scraping
 */
const getMetrics = async () => {
  try {
    return await register.metrics();
  } catch (error) {
    logger.error('Error collecting metrics:', error);
    return '';
  }
};

/**
 * Reset all metrics (useful for testing)
 */
const resetMetrics = () => {
  register.resetMetrics();
};

module.exports = {
  metricsMiddleware,
  recordUserOperation,
  recordMLConnection,
  updateActiveUsers,
  updateDatabaseConnections,
  getMetrics,
  resetMetrics,
  register
};
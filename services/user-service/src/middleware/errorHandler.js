const logger = require('../utils/logger');

/**
 * Error handling middleware
 * Must be used after all routes and other middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error details
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Don't expose stack traces in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Default error response
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Service unavailable - database connection failed';
  } else if (err.code === '23505') { // PostgreSQL unique violation
    statusCode = 409;
    message = 'Resource already exists';
  }

  // Send error response
  res.status(statusCode).json({
    error: true,
    status: statusCode,
    message: message,
    ...(isDevelopment && { 
      stack: err.stack,
      originalError: err.toString()
    }),
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
};

/**
 * 404 handler for undefined routes
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: true,
    status: 404,
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
    availableRoutes: {
      auth: [
        'POST /api/auth/register',
        'POST /api/auth/login',
        'POST /api/auth/logout',
        'POST /api/auth/refresh',
        'GET /api/auth/ml/authorize',
        'GET /api/auth/ml/callback'
      ],
      users: [
        'GET /api/users/me',
        'PUT /api/users/me',
        'DELETE /api/users/me',
        'GET /api/users/stats'
      ],
      health: [
        'GET /health',
        'GET /health/detailed'
      ],
      metrics: [
        'GET /metrics'
      ]
    }
  });
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};
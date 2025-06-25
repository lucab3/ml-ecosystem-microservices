const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * JWT Authentication Middleware
 * Validates JWT tokens and extracts user information
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'No token provided'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Invalid token format'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Add user info to request object
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        iat: decoded.iat,
        exp: decoded.exp
      };

      // Check token expiration
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp < now) {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Please login again'
        });
      }

      logger.debug('User authenticated successfully', {
        userId: decoded.userId,
        email: decoded.email
      });

      next();

    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Please login again'
        });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'Token is malformed'
        });
      }

      logger.error('JWT verification error:', jwtError);
      return res.status(401).json({
        error: 'Token validation failed',
        message: 'Unable to verify token'
      });
    }

  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error'
    });
  }
};

/**
 * Optional authentication middleware
 * Sets user info if token is present but doesn't fail if missing
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        iat: decoded.iat,
        exp: decoded.exp
      };

    } catch (jwtError) {
      // Log but don't fail for optional auth
      logger.warn('Optional auth token invalid:', jwtError.message);
    }

    next();

  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next();
  }
};

/**
 * Service-to-service authentication
 * Validates internal service tokens
 */
const serviceAuth = async (req, res, next) => {
  try {
    const serviceToken = req.header('X-Service-Token');
    
    if (!serviceToken) {
      return res.status(401).json({
        error: 'Service authentication required',
        message: 'X-Service-Token header missing'
      });
    }

    if (serviceToken !== process.env.SERVICE_TOKEN) {
      return res.status(403).json({
        error: 'Invalid service token',
        message: 'Service authentication failed'
      });
    }

    // Mark request as internal service call
    req.isServiceCall = true;
    
    logger.debug('Service authenticated successfully');
    next();

  } catch (error) {
    logger.error('Service auth middleware error:', error);
    return res.status(500).json({
      error: 'Service authentication failed',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  authMiddleware,
  optionalAuth,
  serviceAuth
};
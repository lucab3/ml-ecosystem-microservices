const jwt = require('jsonwebtoken');
const redis = require('../config/redis');
const database = require('../config/database');
const logger = require('../utils/logger');

/**
 * Middleware de autenticación JWT
 * Valida tokens JWT y verifica que no estén en blacklist
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verificar que el token no esté en blacklist
    const isBlacklisted = await redis.isTokenBlacklisted(token);
    if (isBlacklisted) {
      logger.security('Blacklisted token attempted', {
        token: token.substring(0, 20) + '...',
        ip: req.ip
      });
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token has been revoked'
      });
    }

    // Verificar y decodificar JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'ml-user-service',
        audience: 'ml-ecosystem'
      });
    } catch (jwtError) {
      logger.security('Invalid JWT token', {
        error: jwtError.message,
        ip: req.ip
      });
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    // Verificar que el usuario todavía existe y está activo
    const userResult = await database.query(
      'SELECT id, ml_user_id, nickname, email, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      logger.security('Token for non-existent user', {
        userId: decoded.userId,
        ip: req.ip
      });
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      logger.security('Token for inactive user', {
        userId: decoded.userId,
        ip: req.ip
      });
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User account is deactivated'
      });
    }

    // Agregar información del usuario al request
    req.user = {
      userId: user.id,
      mlUserId: user.ml_user_id,
      nickname: user.nickname,
      email: user.email,
      tokenPayload: decoded
    };

    // Log de acceso exitoso (solo en debug)
    logger.debug('Authenticated request', {
      userId: user.id,
      mlUserId: user.ml_user_id,
      path: req.path,
      method: req.method
    });

    next();

  } catch (error) {
    logger.error('Error in auth middleware:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication verification failed'
    });
  }
};

/**
 * Middleware opcional de autenticación
 * Similar al authMiddleware pero no falla si no hay token
 */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No hay token, continuar sin autenticación
      req.user = null;
      return next();
    }

    // Si hay token, usar el middleware normal
    return authMiddleware(req, res, next);

  } catch (error) {
    // En caso de error, continuar sin autenticación
    req.user = null;
    next();
  }
};

/**
 * Middleware para verificar roles específicos
 * Debe usarse después del authMiddleware
 */
const requireRole = (roles = []) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      // Por ahora todos los usuarios autenticados tienen el mismo rol
      // En el futuro se puede expandir para manejar roles específicos
      const userRoles = ['user']; // Podría venir de la DB

      const hasRequiredRole = roles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        logger.security('Insufficient permissions', {
          userId: req.user.userId,
          requiredRoles: roles,
          userRoles: userRoles
        });

        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions'
        });
      }

      next();

    } catch (error) {
      logger.error('Error in role middleware:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Permission verification failed'
      });
    }
  };
};

/**
 * Middleware para rate limiting por usuario
 */
const userRateLimit = (maxRequests = 100, windowMinutes = 15) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(); // Si no hay usuario autenticado, usar rate limiting global
      }

      const identifier = `user:${req.user.userId}`;
      const windowSeconds = windowMinutes * 60;
      
      const rateLimitInfo = await redis.incrementRateLimit(
        identifier, 
        windowSeconds, 
        maxRequests
      );

      // Agregar headers de rate limiting
      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': rateLimitInfo.remaining,
        'X-RateLimit-Reset': new Date(rateLimitInfo.resetTime).toISOString()
      });

      if (rateLimitInfo.limited) {
        logger.security('User rate limit exceeded', {
          userId: req.user.userId,
          count: rateLimitInfo.count,
          limit: maxRequests
        });

        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${windowMinutes} minutes.`,
          retryAfter: Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000)
        });
      }

      next();

    } catch (error) {
      logger.error('Error in user rate limit:', error);
      // En caso de error, permitir la request (fail open)
      next();
    }
  };
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  userRateLimit
};
const express = require('express');
const axios = require('axios');
const Joi = require('joi');

const logger = require('../utils/logger');
const redis = require('../config/redis');
const { getUserTokens } = require('../services/userService');
const rateLimiter = require('../utils/mlRateLimiter');
const kafkaProducer = require('../services/kafkaProducer');

const router = express.Router();

// =================== CONFIGURACIÓN ML API ===================
const ML_API_BASE = 'https://api.mercadolibre.com';
const CACHE_TTL = {
  USER_INFO: 300,     // 5 minutos
  PRODUCTS: 60,       // 1 minuto
  PRODUCT_DETAIL: 180 // 3 minutos
};

// =================== VALIDACIÓN SCHEMAS ===================
const productUpdateSchema = Joi.object({
  available_quantity: Joi.number().integer().min(0).required()
});

const searchSchema = Joi.object({
  q: Joi.string().optional(),
  category: Joi.string().optional(),
  offset: Joi.number().integer().min(0).default(0),
  limit: Joi.number().integer().min(1).max(200).default(50)
});

// =================== UTILIDADES ===================
async function makeMLRequest(endpoint, options = {}) {
  const {
    method = 'GET',
    data = null,
    accessToken,
    useRateLimit = true,
    cacheKey = null,
    cacheTTL = 60
  } = options;

  // Verificar rate limit
  if (useRateLimit) {
    const canProceed = await rateLimiter.checkRateLimit(accessToken || 'global');
    if (!canProceed) {
      throw new Error('RATE_LIMIT_EXCEEDED');
    }
  }

  // Verificar cache
  if (method === 'GET' && cacheKey) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug('Cache hit', { key: cacheKey });
      return cached;
    }
  }

  const headers = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const config = {
    method,
    url: `${ML_API_BASE}${endpoint}`,
    headers,
    timeout: 10000
  };

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    
    // Registrar en rate limiter
    if (useRateLimit) {
      await rateLimiter.recordRequest(accessToken || 'global');
    }

    // Guardar en cache
    if (method === 'GET' && cacheKey && response.data) {
      await redis.set(cacheKey, response.data, cacheTTL);
    }

    return response.data;

  } catch (error) {
    // Manejar errores específicos de ML
    if (error.response) {
      const status = error.response.status;
      const mlError = error.response.data;

      logger.error('ML API Error', {
        endpoint,
        status,
        error: mlError,
        method
      });

      // Error 429 - Rate limit de ML
      if (status === 429) {
        await rateLimiter.handleRateLimit(accessToken || 'global');
        throw new Error('ML_RATE_LIMIT_EXCEEDED');
      }

      // Error 401 - Token inválido
      if (status === 401) {
        throw new Error('INVALID_TOKEN');
      }

      // Error 404
      if (status === 404) {
        throw new Error('NOT_FOUND');
      }

      throw new Error(`ML_API_ERROR:${status}:${mlError.message || 'Unknown error'}`);
    }

    throw error;
  }
}

// =================== RUTAS ===================

/**
 * GET /api/ml/user/me
 * Obtiene información del usuario de ML
 */
router.get('/user/me', async (req, res) => {
  try {
    const userId = req.user.userId;
    const tokens = await getUserTokens(userId);
    
    if (!tokens || !tokens.access_token) {
      return res.status(401).json({
        error: 'No ML tokens found',
        message: 'User needs to re-authenticate with MercadoLibre'
      });
    }

    const cacheKey = `ml_user:${userId}`;
    
    const userData = await makeMLRequest('/users/me', {
      accessToken: tokens.access_token,
      cacheKey,
      cacheTTL: CACHE_TTL.USER_INFO
    });

    res.json({
      success: true,
      data: userData
    });

  } catch (error) {
    logger.error('Error getting ML user info:', error);
    
    if (error.message === 'INVALID_TOKEN') {
      return res.status(401).json({
        error: 'Invalid ML token',
        message: 'Please re-authenticate with MercadoLibre'
      });
    }

    res.status(500).json({
      error: 'Failed to get user info',
      message: error.message
    });
  }
});

/**
 * GET /api/ml/users/:userId/items
 * Obtiene productos del usuario
 */
router.get('/users/:userId/items', async (req, res) => {
  try {
    const mlUserId = req.params.userId;
    const currentUserId = req.user.userId;
    
    // Validar que el usuario solo pueda acceder a sus propios productos
    if (req.user.mlUserId !== mlUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own products'
      });
    }

    const { error, value } = searchSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { offset, limit } = value;
    const tokens = await getUserTokens(currentUserId);

    if (!tokens || !tokens.access_token) {
      return res.status(401).json({
        error: 'No ML tokens found'
      });
    }

    const cacheKey = `ml_products:${mlUserId}:${offset}:${limit}`;
    
    const products = await makeMLRequest(
      `/users/${mlUserId}/items/search?offset=${offset}&limit=${limit}`,
      {
        accessToken: tokens.access_token,
        cacheKey,
        cacheTTL: CACHE_TTL.PRODUCTS
      }
    );

    // Enviar evento para analytics
    await kafkaProducer.sendEvent('products.listed', {
      userId: currentUserId,
      mlUserId,
      productCount: products.results?.length || 0,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      data: products
    });

  } catch (error) {
    logger.error('Error getting user products:', error);
    
    if (error.message === 'ML_RATE_LIMIT_EXCEEDED') {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests to MercadoLibre API',
        retryAfter: 60
      });
    }

    res.status(500).json({
      error: 'Failed to get products',
      message: error.message
    });
  }
});

/**
 * GET /api/ml/items/:itemId
 * Obtiene detalles de un producto específico
 */
router.get('/items/:itemId', async (req, res) => {
  try {
    const itemId = req.params.itemId;
    const userId = req.user.userId;
    
    const tokens = await getUserTokens(userId);
    if (!tokens || !tokens.access_token) {
      return res.status(401).json({
        error: 'No ML tokens found'
      });
    }

    const cacheKey = `ml_item:${itemId}`;
    
    const itemData = await makeMLRequest(`/items/${itemId}`, {
      accessToken: tokens.access_token,
      cacheKey,
      cacheTTL: CACHE_TTL.PRODUCT_DETAIL
    });

    // Enviar evento para analytics
    await kafkaProducer.sendEvent('product.viewed', {
      userId,
      itemId,
      title: itemData.title,
      availableQuantity: itemData.available_quantity,
      price: itemData.price,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      data: itemData
    });

  } catch (error) {
    logger.error('Error getting item details:', error);
    
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({
        error: 'Item not found',
        message: 'The requested item does not exist'
      });
    }

    res.status(500).json({
      error: 'Failed to get item details',
      message: error.message
    });
  }
});

/**
 * PUT /api/ml/items/:itemId
 * Actualiza un producto (principalmente stock)
 */
router.put('/items/:itemId', async (req, res) => {
  try {
    const itemId = req.params.itemId;
    const userId = req.user.userId;

    const { error, value } = productUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const tokens = await getUserTokens(userId);
    if (!tokens || !tokens.access_token) {
      return res.status(401).json({
        error: 'No ML tokens found'
      });
    }

    // Obtener datos actuales del producto para comparar
    const currentItem = await makeMLRequest(`/items/${itemId}`, {
      accessToken: tokens.access_token,
      useRateLimit: false // No aplicar rate limit para lecturas internas
    });

    const oldQuantity = currentItem.available_quantity;
    const newQuantity = value.available_quantity;

    // Actualizar en ML
    const updatedItem = await makeMLRequest(`/items/${itemId}`, {
      method: 'PUT',
      data: value,
      accessToken: tokens.access_token
    });

    // Invalidar cache
    await redis.del(`ml_item:${itemId}`);

    // Enviar evento de cambio de stock
    await kafkaProducer.sendEvent('stock.updated', {
      userId,
      itemId,
      title: currentItem.title,
      oldQuantity,
      newQuantity,
      change: newQuantity - oldQuantity,
      timestamp: Date.now()
    });

    logger.event('Stock updated', {
      userId,
      itemId,
      oldQuantity,
      newQuantity,
      change: newQuantity - oldQuantity
    });

    res.json({
      success: true,
      data: updatedItem,
      changes: {
        stock: {
          old: oldQuantity,
          new: newQuantity,
          change: newQuantity - oldQuantity
        }
      }
    });

  } catch (error) {
    logger.error('Error updating item:', error);
    
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({
        error: 'Item not found'
      });
    }

    if (error.message.includes('FORBIDDEN')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own items'
      });
    }

    res.status(500).json({
      error: 'Failed to update item',
      message: error.message
    });
  }
});

/**
 * GET /api/ml/categories/:categoryId
 * Obtiene información de una categoría
 */
router.get('/categories/:categoryId', async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const cacheKey = `ml_category:${categoryId}`;
    
    const categoryData = await makeMLRequest(`/categories/${categoryId}`, {
      cacheKey,
      cacheTTL: 3600, // 1 hora - las categorías cambian poco
      useRateLimit: false // No aplicar rate limit para categorías
    });

    res.json({
      success: true,
      data: categoryData
    });

  } catch (error) {
    logger.error('Error getting category:', error);
    
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({
        error: 'Category not found'
      });
    }

    res.status(500).json({
      error: 'Failed to get category',
      message: error.message
    });
  }
});

/**
 * GET /api/ml/sites/:siteId/search
 * Búsqueda de productos en ML
 */
router.get('/sites/:siteId/search', async (req, res) => {
  try {
    const siteId = req.params.siteId;
    const { error, value } = searchSchema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { q, category, offset, limit } = value;
    
    // Construir query string
    const params = new URLSearchParams({
      offset: offset.toString(),
      limit: limit.toString()
    });
    
    if (q) params.append('q', q);
    if (category) params.append('category', category);

    const cacheKey = `ml_search:${siteId}:${params.toString()}`;
    
    const searchResults = await makeMLRequest(
      `/sites/${siteId}/search?${params.toString()}`,
      {
        cacheKey,
        cacheTTL: CACHE_TTL.PRODUCTS,
        useRateLimit: false // Búsquedas públicas sin rate limit
      }
    );

    res.json({
      success: true,
      data: searchResults
    });

  } catch (error) {
    logger.error('Error searching ML:', error);
    
    res.status(500).json({
      error: 'Failed to search',
      message: error.message
    });
  }
});

/**
 * GET /api/ml/health
 * Health check específico de ML API
 */
router.get('/health', async (req, res) => {
  try {
    // Test simple a ML API sin autenticación
    const start = Date.now();
    await makeMLRequest('/sites/MLA', {
      useRateLimit: false
    });
    const responseTime = Date.now() - start;

    // Obtener stats del rate limiter
    const rateLimitStats = await rateLimiter.getStats();

    res.json({
      success: true,
      ml_api: {
        status: 'healthy',
        response_time: `${responseTime}ms`
      },
      rate_limiting: rateLimitStats,
      cache: await redis.healthCheck(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('ML API health check failed:', error);
    
    res.status(503).json({
      success: false,
      ml_api: {
        status: 'unhealthy',
        error: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
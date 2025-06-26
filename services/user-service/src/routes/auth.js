const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Joi = require('joi');

const logger = require('../utils/logger');
const redis = require('../config/redis');
const User = require('../models/User');
const { sendKafkaEvent } = require('../services/kafkaProducer');

const router = express.Router();

// ML OAuth Configuration
const ML_OAUTH_CONFIG = {
  clientId: process.env.ML_CLIENT_ID,
  clientSecret: process.env.ML_CLIENT_SECRET,
  redirectUri: process.env.ML_REDIRECT_URI,
  baseUrl: 'https://auth.mercadolibre.com.ar',
  apiUrl: 'https://api.mercadolibre.com'
};

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().max(50).required(),
  lastName: Joi.string().max(50).required(),
  phone: Joi.string().optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const mlTokenSchema = Joi.object({
  code: Joi.string().required(),
  state: Joi.string().optional()
});

// JWT Helper
function generateJWT(userId, email) {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

// =================== AUTHENTICATION ROUTES ===================

/**
 * POST /api/auth/register
 * Register new user
 */
router.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { email, password, firstName, lastName, phone } = value;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'An account with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const userId = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      mlConnected: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Generate JWT
    const token = generateJWT(userId, email);

    // Cache user session
    await redis.set(`user_session:${userId}`, {
      userId,
      email,
      loginTime: Date.now()
    }, 86400); // 24 hours

    // Send registration event
    await sendKafkaEvent('user.registered', {
      userId,
      email,
      firstName,
      lastName,
      timestamp: Date.now()
    });

    logger.info('User registered successfully', { userId, email });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        userId,
        email,
        firstName,
        lastName,
        token,
        mlConnected: false
      }
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { email, password } = value;

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Generate JWT
    const token = generateJWT(user.id, user.email);

    // Cache user session
    await redis.set(`user_session:${user.id}`, {
      userId: user.id,
      email: user.email,
      loginTime: Date.now()
    }, 86400);

    // Update last login
    await User.updateLastLogin(user.id);

    // Send login event
    await sendKafkaEvent('user.logged_in', {
      userId: user.id,
      email: user.email,
      timestamp: Date.now()
    });

    logger.info('User logged in successfully', { userId: user.id, email });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        token,
        mlConnected: user.mlConnected,
        mlUserId: user.mlUserId
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/logout
 * User logout
 */
router.post('/logout', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Remove session from cache
    await redis.del(`user_session:${userId}`);

    // Send logout event
    await sendKafkaEvent('user.logged_out', {
      userId,
      timestamp: Date.now()
    });

    logger.info('User logged out', { userId });

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'Internal server error'
    });
  }
});

// =================== MERCADOLIBRE OAUTH ===================

/**
 * GET /api/auth/ml/connect
 * Generates ML OAuth URL
 */
router.get('/ml/connect', (req, res) => {
  try {
    const state = jwt.sign(
      { 
        userId: req.user?.userId,
        timestamp: Date.now() 
      },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    const authUrl = `${ML_OAUTH_CONFIG.baseUrl}/authorization?` +
      `response_type=code&` +
      `client_id=${ML_OAUTH_CONFIG.clientId}&` +
      `redirect_uri=${encodeURIComponent(ML_OAUTH_CONFIG.redirectUri)}&` +
      `state=${state}`;

    res.json({
      success: true,
      authUrl,
      state
    });

  } catch (error) {
    logger.error('ML connect URL generation error:', error);
    res.status(500).json({
      error: 'Failed to generate ML auth URL'
    });
  }
});

/**
 * POST /api/auth/ml/callback
 * Handles ML OAuth callback
 */
router.post('/ml/callback', async (req, res) => {
  try {
    const { error, value } = mlTokenSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { code, state } = value;

    // Verify state
    if (state) {
      try {
        const decoded = jwt.verify(state, process.env.JWT_SECRET);
        if (Date.now() - decoded.timestamp > 600000) { // 10 minutes
          return res.status(400).json({
            error: 'State expired',
            message: 'OAuth state has expired'
          });
        }
      } catch (stateError) {
        return res.status(400).json({
          error: 'Invalid state',
          message: 'OAuth state is invalid'
        });
      }
    }

    // Exchange code for token
    const tokenResponse = await axios.post('https://api.mercadolibre.com/oauth/token', {
      grant_type: 'authorization_code',
      client_id: ML_OAUTH_CONFIG.clientId,
      client_secret: ML_OAUTH_CONFIG.clientSecret,
      code,
      redirect_uri: ML_OAUTH_CONFIG.redirectUri
    });

    const {
      access_token,
      token_type,
      expires_in,
      scope,
      user_id,
      refresh_token
    } = tokenResponse.data;

    // Get user info from ML
    const userResponse = await axios.get(`${ML_OAUTH_CONFIG.apiUrl}/users/me`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const mlUserData = userResponse.data;

    // 🔒 AUTHORIZATION CHECK: Verify if ML user is in allowed list
    const authorizedUsers = process.env.AUTHORIZED_ML_USERS?.split(',').map(id => id.trim()) || [];
    const mlUserId = String(user_id);
    
    if (authorizedUsers.length > 0 && !authorizedUsers.includes(mlUserId)) {
      logger.warn('Unauthorized ML user attempted access', { 
        mlUserId,
        mlUserEmail: mlUserData.email,
        mlUserNickname: mlUserData.nickname,
        authorizedCount: authorizedUsers.length,
        timestamp: new Date().toISOString()
      });
      
      return res.status(403).json({
        error: 'Access denied',
        message: 'Tu cuenta de MercadoLibre no está autorizada para usar esta aplicación. Contacta al administrador para solicitar acceso.',
        details: {
          mlUserId,
          mlUserEmail: mlUserData.email,
          mlUserNickname: mlUserData.nickname,
          reason: 'User not in authorized list'
        }
      });
    }

    logger.info('Authorized ML user connecting', { 
      mlUserId,
      mlUserEmail: mlUserData.email,
      mlUserNickname: mlUserData.nickname
    });

    // Save tokens and ML user data
    const userId = req.user?.userId;
    if (userId) {
      await User.updateMLTokens(userId, {
        accessToken: access_token,
        tokenType: token_type,
        expiresIn: expires_in,
        scope,
        mlUserId: user_id,
        refreshToken: refresh_token,
        mlUserData,
        connectedAt: new Date()
      });

      // Cache tokens
      await redis.set(`ml_tokens:${userId}`, {
        access_token,
        token_type,
        expires_in,
        expires_at: Date.now() + (expires_in * 1000),
        scope,
        user_id,
        refresh_token
      }, expires_in);

      // Send connection event
      await sendKafkaEvent('ml.connected', {
        userId,
        mlUserId: user_id,
        mlUserData,
        timestamp: Date.now()
      });

      logger.info('ML account connected', { userId, mlUserId: user_id });
    }

    res.json({
      success: true,
      message: 'MercadoLibre account connected successfully',
      data: {
        mlUserId: user_id,
        mlUserData: {
          id: mlUserData.id,
          nickname: mlUserData.nickname,
          email: mlUserData.email,
          firstName: mlUserData.first_name,
          lastName: mlUserData.last_name,
          country: mlUserData.country_id,
          site: mlUserData.site_id
        },
        scopes: scope?.split(' ') || []
      }
    });

  } catch (error) {
    logger.error('ML OAuth callback error:', error);
    
    if (error.response?.status === 400) {
      return res.status(400).json({
        error: 'Invalid authorization code',
        message: 'The authorization code is invalid or expired'
      });
    }

    res.status(500).json({
      error: 'ML OAuth failed',
      message: 'Failed to connect MercadoLibre account'
    });
  }
});

/**
 * POST /api/auth/ml/refresh
 * Refresh ML token
 */
router.post('/ml/refresh', async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (!user || !user.mlRefreshToken) {
      return res.status(400).json({
        error: 'No refresh token available',
        message: 'User needs to re-authenticate with MercadoLibre'
      });
    }

    const refreshResponse = await axios.post('https://api.mercadolibre.com/oauth/token', {
      grant_type: 'refresh_token',
      client_id: ML_OAUTH_CONFIG.clientId,
      client_secret: ML_OAUTH_CONFIG.clientSecret,
      refresh_token: user.mlRefreshToken
    });

    const {
      access_token,
      token_type,
      expires_in,
      scope,
      refresh_token
    } = refreshResponse.data;

    // Update tokens
    await User.updateMLTokens(userId, {
      accessToken: access_token,
      tokenType: token_type,
      expiresIn: expires_in,
      scope,
      refreshToken: refresh_token || user.mlRefreshToken,
      updatedAt: new Date()
    });

    // Update cache
    await redis.set(`ml_tokens:${userId}`, {
      access_token,
      token_type,
      expires_in,
      expires_at: Date.now() + (expires_in * 1000),
      scope,
      user_id: user.mlUserId,
      refresh_token: refresh_token || user.mlRefreshToken
    }, expires_in);

    logger.info('ML token refreshed', { userId });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      expiresIn: expires_in
    });

  } catch (error) {
    logger.error('ML token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      message: 'Failed to refresh MercadoLibre token'
    });
  }
});

/**
 * DELETE /api/auth/ml/disconnect
 * Disconnect ML account
 */
router.delete('/ml/disconnect', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Remove ML tokens
    await User.clearMLTokens(userId);
    
    // Remove from cache
    await redis.del(`ml_tokens:${userId}`);
    
    // Send disconnection event
    await sendKafkaEvent('ml.disconnected', {
      userId,
      timestamp: Date.now()
    });

    logger.info('ML account disconnected', { userId });

    res.json({
      success: true,
      message: 'MercadoLibre account disconnected successfully'
    });

  } catch (error) {
    logger.error('ML disconnect error:', error);
    res.status(500).json({
      error: 'Disconnect failed',
      message: 'Failed to disconnect MercadoLibre account'
    });
  }
});

/**
 * GET /api/auth/ml/status
 * Get ML connection status
 */
router.get('/ml/status', async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const mlConnected = !!user.mlAccessToken;
    const tokenExpired = user.mlTokenExpiresAt && 
      new Date(user.mlTokenExpiresAt) < new Date();

    res.json({
      success: true,
      data: {
        connected: mlConnected,
        tokenExpired,
        mlUserId: user.mlUserId,
        connectedAt: user.mlConnectedAt,
        scopes: user.mlScopes?.split(' ') || [],
        canRefresh: !!user.mlRefreshToken
      }
    });

  } catch (error) {
    logger.error('ML status check error:', error);
    res.status(500).json({
      error: 'Status check failed',
      message: 'Failed to check MercadoLibre status'
    });
  }
});

module.exports = router;
const express = require('express');
const Joi = require('joi');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const logger = require('../utils/logger');
// Use mock Kafka in development
const useMockKafka = process.env.USE_MOCK_KAFKA === 'true' || process.env.NODE_ENV === 'development';
const { sendKafkaEvent } = useMockKafka 
  ? require('../services/mockKafka')
  : require('../services/kafkaProducer');

const router = express.Router();

// Validation schemas
const updateProfileSchema = Joi.object({
  firstName: Joi.string().max(50).optional(),
  lastName: Joi.string().max(50).optional(),
  phone: Joi.string().max(20).optional()
});

/**
 * GET /api/users/me
 * Get current user profile
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile does not exist'
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        mlConnected: user.ml_connected,
        mlUserId: user.ml_user_id,
        lastLogin: user.last_login,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    logger.error('Error getting user profile:', error);
    res.status(500).json({
      error: 'Failed to get profile',
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/users/me
 * Update current user profile
 */
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const updatedUser = await User.updateProfile(req.user.userId, value);
    
    if (!updatedUser) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Unable to update profile'
      });
    }

    // Send profile update event
    await sendKafkaEvent('user.profile_updated', {
      userId: req.user.userId,
      changes: value,
      timestamp: Date.now()
    });

    logger.info('User profile updated', { 
      userId: req.user.userId,
      changes: Object.keys(value)
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        phone: updatedUser.phone,
        updatedAt: updatedUser.updated_at
      }
    });

  } catch (error) {
    logger.error('Error updating user profile:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/users/:userId/ml-tokens
 * Get ML tokens for a user (internal service call)
 */
router.get('/:userId/ml-tokens', async (req, res) => {
  try {
    // Verify service authentication
    const serviceToken = req.header('X-Service-Token');
    if (serviceToken !== process.env.SERVICE_TOKEN) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Service authentication required'
      });
    }

    const userId = req.params.userId;
    const tokens = await User.getMLTokens(userId);
    
    if (!tokens) {
      return res.status(404).json({
        error: 'No ML tokens found',
        message: 'User has not connected MercadoLibre account'
      });
    }

    res.json({
      success: true,
      data: tokens
    });

  } catch (error) {
    logger.error('Error getting ML tokens:', error);
    res.status(500).json({
      error: 'Failed to get ML tokens',
      message: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/users/me
 * Delete current user account
 */
router.delete('/me', authMiddleware, async (req, res) => {
  try {
    await User.deleteUser(req.user.userId);

    // Send account deletion event
    await sendKafkaEvent('user.account_deleted', {
      userId: req.user.userId,
      email: req.user.email,
      timestamp: Date.now()
    });

    logger.info('User account deleted', { userId: req.user.userId });

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting user account:', error);
    res.status(500).json({
      error: 'Failed to delete account',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/users/stats
 * Get user statistics (admin only)
 */
router.get('/stats', async (req, res) => {
  try {
    // Simple admin check - in production use proper role-based auth
    const adminToken = req.header('X-Admin-Token');
    if (adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(403).json({
        error: 'Admin access required'
      });
    }

    const stats = await User.getUserStats();

    res.json({
      success: true,
      data: {
        totalUsers: parseInt(stats.total_users),
        mlConnectedUsers: parseInt(stats.ml_connected_users),
        newUsersThisWeek: parseInt(stats.new_users_week),
        activeUsersToday: parseInt(stats.active_users_day),
        mlConnectionRate: ((parseInt(stats.ml_connected_users) / parseInt(stats.total_users)) * 100).toFixed(2) + '%'
      }
    });

  } catch (error) {
    logger.error('Error getting user stats:', error);
    res.status(500).json({
      error: 'Failed to get user stats',
      message: 'Internal server error'
    });
  }
});

module.exports = router;
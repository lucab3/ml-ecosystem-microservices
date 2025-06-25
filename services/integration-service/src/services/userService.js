const axios = require('axios');
const logger = require('../utils/logger');
const redis = require('../config/redis');

class UserService {
  constructor() {
    this.baseURL = process.env.USER_SERVICE_URL || 'http://user-service:3001';
    this.timeout = 5000;
  }

  async getUserTokens(userId) {
    try {
      // Try cache first
      const cached = await redis.getUserTokens(userId);
      if (cached) {
        logger.debug('User tokens retrieved from cache', { userId });
        return cached;
      }

      // Fetch from user service
      const response = await axios.get(`${this.baseURL}/api/users/${userId}/ml-tokens`, {
        timeout: this.timeout,
        headers: {
          'X-Service-Token': process.env.SERVICE_TOKEN
        }
      });

      const tokens = response.data.data;
      
      // Cache for 30 minutes
      if (tokens) {
        await redis.cacheUserTokens(userId, tokens, 1800);
      }

      logger.debug('User tokens retrieved from service', { userId });
      return tokens;

    } catch (error) {
      if (error.response?.status === 404) {
        logger.warn('User tokens not found', { userId });
        return null;
      }
      
      logger.error('Error fetching user tokens:', error);
      throw new Error('USER_TOKENS_FETCH_FAILED');
    }
  }

  async getUserInfo(userId) {
    try {
      const response = await axios.get(`${this.baseURL}/api/users/${userId}`, {
        timeout: this.timeout,
        headers: {
          'X-Service-Token': process.env.SERVICE_TOKEN
        }
      });

      return response.data.data;

    } catch (error) {
      if (error.response?.status === 404) {
        logger.warn('User not found', { userId });
        return null;
      }
      
      logger.error('Error fetching user info:', error);
      throw new Error('USER_INFO_FETCH_FAILED');
    }
  }

  async refreshUserTokens(userId, refreshToken) {
    try {
      const response = await axios.post(`${this.baseURL}/api/auth/ml/refresh`, 
        { refresh_token: refreshToken },
        {
          timeout: this.timeout,
          headers: {
            'X-Service-Token': process.env.SERVICE_TOKEN,
            'X-User-ID': userId
          }
        }
      );

      const newTokens = response.data.data;
      
      // Update cache
      if (newTokens) {
        await redis.cacheUserTokens(userId, newTokens, 1800);
      }

      logger.info('User tokens refreshed', { userId });
      return newTokens;

    } catch (error) {
      logger.error('Error refreshing user tokens:', error);
      throw new Error('TOKEN_REFRESH_FAILED');
    }
  }

  async validateUser(userId) {
    try {
      const user = await this.getUserInfo(userId);
      return !!user;
    } catch (error) {
      return false;
    }
  }

  async isMLConnected(userId) {
    try {
      const tokens = await this.getUserTokens(userId);
      return !!(tokens && tokens.access_token);
    } catch (error) {
      return false;
    }
  }

  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 2000
      });
      
      return {
        status: 'healthy',
        response_time: response.headers['x-response-time'] || 'unknown',
        service: 'user-service'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        service: 'user-service'
      };
    }
  }
}

module.exports = new UserService();
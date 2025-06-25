const request = require('supertest');
const nock = require('nock');
const app = require('../../app');
const redis = require('../../config/redis');
const userService = require('../../services/userService');

describe('Integration Service - ML API Routes', () => {
  let authToken;
  let mockUserId = 'test-user-123';
  let mockMLUserId = 'ML123456789';

  beforeAll(async () => {
    // Setup Redis connection for tests
    await redis.connect();
    
    // Mock JWT token for tests
    authToken = 'Bearer test-jwt-token';
  });

  afterAll(async () => {
    await redis.disconnect();
    nock.restore();
  });

  beforeEach(() => {
    // Reset nock and clear Redis cache before each test
    nock.cleanAll();
    jest.clearAllMocks();
  });

  describe('GET /api/ml/user/me', () => {
    it('should return ML user info successfully', async () => {
      // Mock user service response
      jest.spyOn(userService, 'getUserTokens').mockResolvedValue({
        access_token: 'mock-access-token',
        ml_user_id: mockMLUserId
      });

      // Mock ML API response
      nock('https://api.mercadolibre.com')
        .get('/users/me')
        .reply(200, {
          id: mockMLUserId,
          nickname: 'testuser',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          country_id: 'AR',
          site_id: 'MLA'
        });

      const response = await request(app)
        .get('/api/ml/user/me')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockMLUserId);
      expect(response.body.data.nickname).toBe('testuser');
    });

    it('should return 401 when no ML tokens found', async () => {
      jest.spyOn(userService, 'getUserTokens').mockResolvedValue(null);

      const response = await request(app)
        .get('/api/ml/user/me')
        .set('Authorization', authToken)
        .expect(401);

      expect(response.body.error).toBe('No ML tokens found');
    });

    it('should handle ML API errors gracefully', async () => {
      jest.spyOn(userService, 'getUserTokens').mockResolvedValue({
        access_token: 'invalid-token'
      });

      nock('https://api.mercadolibre.com')
        .get('/users/me')
        .reply(401, { message: 'Invalid token' });

      const response = await request(app)
        .get('/api/ml/user/me')
        .set('Authorization', authToken)
        .expect(401);

      expect(response.body.error).toBe('Invalid ML token');
    });
  });

  describe('GET /api/ml/users/:userId/items', () => {
    it('should return user products successfully', async () => {
      jest.spyOn(userService, 'getUserTokens').mockResolvedValue({
        access_token: 'mock-access-token'
      });

      const mockProducts = {
        results: [
          {
            id: 'MLA123456789',
            title: 'Test Product',
            available_quantity: 10,
            price: 1000
          }
        ],
        paging: {
          total: 1,
          offset: 0,
          limit: 50
        }
      };

      nock('https://api.mercadolibre.com')
        .get(`/users/${mockMLUserId}/items/search?offset=0&limit=50`)
        .reply(200, mockProducts);

      const response = await request(app)
        .get(`/api/ml/users/${mockMLUserId}/items`)
        .set('Authorization', authToken)
        .query({ offset: 0, limit: 50 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
      expect(response.body.data.results[0].id).toBe('MLA123456789');
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/ml/users/${mockMLUserId}/items`)
        .set('Authorization', authToken)
        .query({ offset: -1, limit: 300 })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('PUT /api/ml/items/:itemId', () => {
    const mockItemId = 'MLA123456789';

    it('should update product stock successfully', async () => {
      jest.spyOn(userService, 'getUserTokens').mockResolvedValue({
        access_token: 'mock-access-token'
      });

      // Mock current item data
      nock('https://api.mercadolibre.com')
        .get(`/items/${mockItemId}`)
        .reply(200, {
          id: mockItemId,
          title: 'Test Product',
          available_quantity: 5,
          price: 1000
        });

      // Mock update request
      nock('https://api.mercadolibre.com')
        .put(`/items/${mockItemId}`)
        .reply(200, {
          id: mockItemId,
          title: 'Test Product',
          available_quantity: 10,
          price: 1000
        });

      const response = await request(app)
        .put(`/api/ml/items/${mockItemId}`)
        .set('Authorization', authToken)
        .send({ available_quantity: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.available_quantity).toBe(10);
      expect(response.body.changes.stock.old).toBe(5);
      expect(response.body.changes.stock.new).toBe(10);
    });

    it('should validate update data', async () => {
      const response = await request(app)
        .put(`/api/ml/items/${mockItemId}`)
        .set('Authorization', authToken)
        .send({ available_quantity: -1 })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should handle item not found', async () => {
      jest.spyOn(userService, 'getUserTokens').mockResolvedValue({
        access_token: 'mock-access-token'
      });

      nock('https://api.mercadolibre.com')
        .get(`/items/${mockItemId}`)
        .reply(404, { message: 'Item not found' });

      const response = await request(app)
        .put(`/api/ml/items/${mockItemId}`)
        .set('Authorization', authToken)
        .send({ available_quantity: 10 })
        .expect(404);

      expect(response.body.error).toBe('Item not found');
    });
  });

  describe('GET /api/ml/health', () => {
    it('should return health status successfully', async () => {
      // Mock ML API health check
      nock('https://api.mercadolibre.com')
        .get('/sites/MLA')
        .reply(200, { id: 'MLA', name: 'Argentina' });

      const response = await request(app)
        .get('/api/ml/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.ml_api.status).toBe('healthy');
      expect(response.body.ml_api.response_time).toMatch(/\d+ms/);
    });

    it('should return unhealthy when ML API is down', async () => {
      nock('https://api.mercadolibre.com')
        .get('/sites/MLA')
        .reply(500, { message: 'Internal server error' });

      const response = await request(app)
        .get('/api/ml/health')
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.ml_api.status).toBe('unhealthy');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting for ML API calls', async () => {
      jest.spyOn(userService, 'getUserTokens').mockResolvedValue({
        access_token: 'mock-access-token'
      });

      // Mock rate limiter to exceed limit
      const mlRateLimiter = require('../../utils/mlRateLimiter');
      jest.spyOn(mlRateLimiter, 'checkRateLimit').mockResolvedValue(false);

      nock('https://api.mercadolibre.com')
        .get('/users/me')
        .reply(200, { id: mockMLUserId });

      const response = await request(app)
        .get('/api/ml/user/me')
        .set('Authorization', authToken)
        .expect(429);

      expect(response.body.error).toBe('Rate limit exceeded');
    });
  });

  describe('Caching', () => {
    it('should cache ML API responses', async () => {
      const cacheKey = `ml_user:${mockUserId}`;
      const cachedData = {
        id: mockMLUserId,
        nickname: 'cached_user'
      };

      // Pre-populate cache
      await redis.set(cacheKey, cachedData, 300);

      jest.spyOn(userService, 'getUserTokens').mockResolvedValue({
        access_token: 'mock-access-token'
      });

      const response = await request(app)
        .get('/api/ml/user/me')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.data.nickname).toBe('cached_user');
      
      // Verify no actual API call was made
      expect(nock.isDone()).toBe(true);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit breaker on multiple failures', async () => {
      jest.spyOn(userService, 'getUserTokens').mockResolvedValue({
        access_token: 'mock-access-token'
      });

      // Mock multiple failures to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        nock('https://api.mercadolibre.com')
          .get('/users/me')
          .reply(500, { message: 'Server error' });
      }

      // Make multiple requests to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get('/api/ml/user/me')
          .set('Authorization', authToken)
          .expect(500);
      }

      // Circuit breaker should now be open
      const response = await request(app)
        .get('/api/ml/user/me')
        .set('Authorization', authToken)
        .expect(503);

      expect(response.body.error).toContain('Circuit breaker');
    });
  });
});
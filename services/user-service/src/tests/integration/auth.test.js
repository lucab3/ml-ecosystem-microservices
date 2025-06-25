const request = require('supertest');
const nock = require('nock');
const bcrypt = require('bcrypt');
const app = require('../../app');
const User = require('../../models/User');
const redis = require('../../config/redis');

describe('User Service - Authentication Routes', () => {
  beforeAll(async () => {
    await redis.connect();
    // Initialize test database
    await User.initializeDatabase();
  });

  afterAll(async () => {
    await redis.disconnect();
    await User.close();
    nock.restore();
  });

  beforeEach(async () => {
    // Clean up test data
    nock.cleanAll();
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    const validUserData = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      phone: '+5491123456789'
    };

    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(validUserData.email);
      expect(response.body.data.firstName).toBe(validUserData.firstName);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.mlConnected).toBe(false);

      // Verify user was created in database
      const user = await User.findByEmail(validUserData.email);
      expect(user).toBeTruthy();
      expect(user.email).toBe(validUserData.email);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: '123' // Too short
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should reject duplicate email registration', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(409);

      expect(response.body.error).toBe('User already exists');
    });

    it('should hash the password before storing', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      const user = await User.findByEmail(validUserData.email);
      expect(user.password).not.toBe(validUserData.password);
      
      // Verify password can be verified
      const isValid = await bcrypt.compare(validUserData.password, user.password);
      expect(isValid).toBe(true);
    });
  });

  describe('POST /api/auth/login', () => {
    const userData = {
      email: 'login@example.com',
      password: 'password123',
      firstName: 'Login',
      lastName: 'Test'
    };

    beforeEach(async () => {
      // Create a test user for login tests
      await request(app)
        .post('/api/auth/register')
        .send(userData);
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(userData.email);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.userId).toBeDefined();
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: userData.password
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should cache user session after login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      const userId = response.body.data.userId;
      const sessionKey = `user_session:${userId}`;
      const session = await redis.get(sessionKey);

      expect(session).toBeTruthy();
      expect(session.userId).toBe(userId);
      expect(session.email).toBe(userData.email);
    });
  });

  describe('MercadoLibre OAuth Flow', () => {
    let authToken;
    let userId;

    beforeEach(async () => {
      // Create and login user to get auth token
      const userData = {
        email: 'oauth@example.com',
        password: 'password123',
        firstName: 'OAuth',
        lastName: 'Test'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      authToken = loginResponse.body.data.token;
      userId = loginResponse.body.data.userId;
    });

    describe('GET /api/auth/ml/connect', () => {
      it('should generate ML OAuth URL', async () => {
        const response = await request(app)
          .get('/api/auth/ml/connect')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.authUrl).toContain('https://auth.mercadolibre.com.ar/authorization');
        expect(response.body.authUrl).toContain('client_id=');
        expect(response.body.authUrl).toContain('redirect_uri=');
        expect(response.body.state).toBeDefined();
      });
    });

    describe('POST /api/auth/ml/callback', () => {
      it('should handle ML OAuth callback successfully', async () => {
        // Mock ML token exchange
        nock('https://api.mercadolibre.com')
          .post('/oauth/token')
          .reply(200, {
            access_token: 'mock-access-token',
            token_type: 'Bearer',
            expires_in: 21600,
            scope: 'read write',
            user_id: 123456789,
            refresh_token: 'mock-refresh-token'
          });

        // Mock ML user info request
        nock('https://api.mercadolibre.com')
          .get('/users/me')
          .reply(200, {
            id: 123456789,
            nickname: 'TESTUSER',
            email: 'oauth@example.com',
            first_name: 'Test',
            last_name: 'User',
            country_id: 'AR',
            site_id: 'MLA'
          });

        const response = await request(app)
          .post('/api/auth/ml/callback')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            code: 'mock-authorization-code'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.mlUserId).toBe(123456789);
        expect(response.body.data.mlUserData.nickname).toBe('TESTUSER');

        // Verify tokens were stored
        const user = await User.findById(userId);
        expect(user.ml_connected).toBe(true);
        expect(user.ml_user_id).toBe('123456789');
        expect(user.ml_access_token).toBe('mock-access-token');
      });

      it('should reject invalid authorization code', async () => {
        nock('https://api.mercadolibre.com')
          .post('/oauth/token')
          .reply(400, {
            message: 'invalid_grant',
            error: 'invalid_grant'
          });

        const response = await request(app)
          .post('/api/auth/ml/callback')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            code: 'invalid-code'
          })
          .expect(400);

        expect(response.body.error).toBe('Invalid authorization code');
      });
    });

    describe('POST /api/auth/ml/refresh', () => {
      beforeEach(async () => {
        // Set up user with ML tokens
        await User.updateMLTokens(userId, {
          accessToken: 'old-access-token',
          refreshToken: 'valid-refresh-token',
          expiresIn: 21600,
          mlUserId: '123456789',
          scope: 'read write'
        });
      });

      it('should refresh ML tokens successfully', async () => {
        nock('https://api.mercadolibre.com')
          .post('/oauth/token')
          .reply(200, {
            access_token: 'new-access-token',
            token_type: 'Bearer',
            expires_in: 21600,
            scope: 'read write',
            refresh_token: 'new-refresh-token'
          });

        const response = await request(app)
          .post('/api/auth/ml/refresh')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.expiresIn).toBe(21600);

        // Verify new tokens were stored
        const tokens = await User.getMLTokens(userId);
        expect(tokens.access_token).toBe('new-access-token');
      });

      it('should handle refresh token expiration', async () => {
        nock('https://api.mercadolibre.com')
          .post('/oauth/token')
          .reply(400, {
            message: 'invalid_grant',
            error: 'invalid_grant'
          });

        const response = await request(app)
          .post('/api/auth/ml/refresh')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(500);

        expect(response.body.error).toBe('Token refresh failed');
      });
    });

    describe('GET /api/auth/ml/status', () => {
      it('should return ML connection status', async () => {
        // Set up connected user
        await User.updateMLTokens(userId, {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresIn: 21600,
          mlUserId: '123456789',
          scope: 'read write'
        });

        const response = await request(app)
          .get('/api/auth/ml/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.connected).toBe(true);
        expect(response.body.data.mlUserId).toBe('123456789');
        expect(response.body.data.canRefresh).toBe(true);
      });

      it('should return disconnected status for non-connected user', async () => {
        const response = await request(app)
          .get('/api/auth/ml/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.data.connected).toBe(false);
        expect(response.body.data.mlUserId).toBeNull();
      });
    });

    describe('DELETE /api/auth/ml/disconnect', () => {
      it('should disconnect ML account successfully', async () => {
        // Set up connected user
        await User.updateMLTokens(userId, {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresIn: 21600,
          mlUserId: '123456789',
          scope: 'read write'
        });

        const response = await request(app)
          .delete('/api/auth/ml/disconnect')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify ML tokens were cleared
        const user = await User.findById(userId);
        expect(user.ml_connected).toBe(false);
        expect(user.ml_access_token).toBeNull();
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user successfully', async () => {
      // Create and login user
      const userData = {
        email: 'logout@example.com',
        password: 'password123',
        firstName: 'Logout',
        lastName: 'Test'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      const authToken = loginResponse.body.data.token;
      const userId = loginResponse.body.data.userId;

      // Logout
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify session was cleared from cache
      const sessionKey = `user_session:${userId}`;
      const session = await redis.get(sessionKey);
      expect(session).toBeNull();
    });

    it('should handle logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.error).toBe('No token provided');
    });
  });
});
const { Pool } = require('pg');
const logger = require('../utils/logger');

// Use mock database in development when real DB is not available
const useMockDB = process.env.USE_MOCK_DB === 'true' || process.env.NODE_ENV === 'development';

class User {
  constructor() {
    if (useMockDB) {
      logger.info('Using mock database for development');
      this.mockDB = require('../services/mockDatabase');
      this.pool = null; // No real pool in mock mode
      return;
    }

    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'ml_ecosystem',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Only initialize real database if not using mock
    this.initializeDatabase().catch(error => {
      logger.error('Database initialization failed:', error);
      // Don't crash in development, just log the error
      if (process.env.NODE_ENV !== 'development') {
        throw error;
      }
    });
  }

  async query(sql, params) {
    if (useMockDB) {
      return this.mockDB.query(sql, params);
    }
    return this.pool.query(sql, params);
  }

  async initializeDatabase() {
    if (useMockDB) {
      logger.info('Mock database already initialized');
      return;
    }
    try {
      const client = await this.pool.connect();
      
      // Create users table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          phone VARCHAR(20),
          ml_connected BOOLEAN DEFAULT FALSE,
          ml_user_id VARCHAR(50),
          ml_access_token TEXT,
          ml_refresh_token TEXT,
          ml_token_expires_at TIMESTAMP,
          ml_scopes TEXT,
          ml_user_data JSONB,
          ml_connected_at TIMESTAMP,
          last_login TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_ml_user_id ON users(ml_user_id);
        CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
      `);

      logger.info('Database initialized successfully');
      client.release();
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  async create(userData) {
    const client = await this.pool.connect();
    try {
      const {
        email,
        password,
        firstName,
        lastName,
        phone
      } = userData;

      const query = `
        INSERT INTO users (email, password, first_name, last_name, phone)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, first_name, last_name, phone, created_at
      `;

      const result = await client.query(query, [
        email,
        password,
        firstName,
        lastName,
        phone || null
      ]);

      logger.info('User created successfully', { userId: result.rows[0].id, email });
      return result.rows[0].id;

    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findByEmail(email) {
    try {
      const query = `
        SELECT id, email, password, first_name, last_name, phone,
               ml_connected, ml_user_id, ml_access_token, ml_refresh_token,
               ml_token_expires_at, ml_scopes, ml_user_data, ml_connected_at,
               last_login, created_at, updated_at
        FROM users 
        WHERE email = $1 AND deleted_at IS NULL
      `;

      const result = await this.query(query, [email]);
      return result.rows[0] || null;

    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  async findById(userId) {
    try {
      const query = `
        SELECT id, email, first_name, last_name, phone,
               ml_connected, ml_user_id, ml_access_token, ml_refresh_token,
               ml_token_expires_at, ml_scopes, ml_user_data, ml_connected_at,
               last_login, created_at, updated_at
        FROM users 
        WHERE id = $1 AND deleted_at IS NULL
      `;

      const result = await this.query(query, [userId]);
      return result.rows[0] || null;

    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  async updateLastLogin(userId) {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;

      await client.query(query, [userId]);

    } catch (error) {
      logger.error('Error updating last login:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateMLTokens(userId, tokenData) {
    const client = await this.pool.connect();
    try {
      const {
        accessToken,
        refreshToken,
        expiresIn,
        mlUserId,
        mlUserData,
        scope
      } = tokenData;

      const expiresAt = new Date(Date.now() + (expiresIn * 1000));

      const query = `
        UPDATE users 
        SET ml_connected = TRUE,
            ml_user_id = $2,
            ml_access_token = $3,
            ml_refresh_token = $4,
            ml_token_expires_at = $5,
            ml_scopes = $6,
            ml_user_data = $7,
            ml_connected_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;

      await client.query(query, [
        userId,
        mlUserId,
        accessToken,
        refreshToken,
        expiresAt,
        scope,
        JSON.stringify(mlUserData)
      ]);

      logger.info('ML tokens updated successfully', { userId, mlUserId });

    } catch (error) {
      logger.error('Error updating ML tokens:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async clearMLTokens(userId) {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE users 
        SET ml_connected = FALSE,
            ml_user_id = NULL,
            ml_access_token = NULL,
            ml_refresh_token = NULL,
            ml_token_expires_at = NULL,
            ml_scopes = NULL,
            ml_user_data = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;

      await client.query(query, [userId]);
      logger.info('ML tokens cleared successfully', { userId });

    } catch (error) {
      logger.error('Error clearing ML tokens:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getMLTokens(userId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT ml_access_token, ml_refresh_token, ml_token_expires_at,
               ml_scopes, ml_user_id
        FROM users 
        WHERE id = $1 AND ml_connected = TRUE AND deleted_at IS NULL
      `;

      const result = await client.query(query, [userId]);
      
      if (!result.rows[0]) {
        return null;
      }

      const row = result.rows[0];
      
      // Check if token expired
      const isExpired = row.ml_token_expires_at && 
        new Date(row.ml_token_expires_at) < new Date();

      return {
        access_token: row.ml_access_token,
        refresh_token: row.ml_refresh_token,
        expires_at: row.ml_token_expires_at,
        scopes: row.ml_scopes,
        ml_user_id: row.ml_user_id,
        is_expired: isExpired
      };

    } catch (error) {
      logger.error('Error getting ML tokens:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateProfile(userId, profileData) {
    const client = await this.pool.connect();
    try {
      const {
        firstName,
        lastName,
        phone
      } = profileData;

      const query = `
        UPDATE users 
        SET first_name = $2,
            last_name = $3,
            phone = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, email, first_name, last_name, phone, updated_at
      `;

      const result = await client.query(query, [
        userId,
        firstName,
        lastName,
        phone
      ]);

      return result.rows[0];

    } catch (error) {
      logger.error('Error updating profile:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteUser(userId) {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE users 
        SET deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;

      await client.query(query, [userId]);
      logger.info('User deleted successfully', { userId });

    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserStats() {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN ml_connected = TRUE THEN 1 END) as ml_connected_users,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_users_week,
          COUNT(CASE WHEN last_login >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as active_users_day
        FROM users 
        WHERE deleted_at IS NULL
      `;

      const result = await client.query(query);
      return result.rows[0];

    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck() {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
      return {
        status: 'healthy',
        connected: true,
        pool: {
          total: this.pool.totalCount,
          idle: this.pool.idleCount,
          waiting: this.pool.waitingCount
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message
      };
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}

module.exports = new User();
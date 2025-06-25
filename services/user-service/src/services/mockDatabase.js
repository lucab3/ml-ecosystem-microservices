// Mock Database for Development - User Service
const logger = require('../utils/logger');

class MockDatabase {
  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.initMockData();
  }

  initMockData() {
    // Insert test users
    this.users.set(1, {
      id: 1,
      email: 'demo@example.com',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBqvtMQPd5GMMK', // password123
      first_name: 'Demo',
      last_name: 'User',
      phone: '+5491123456789',
      ml_connected: true,
      ml_user_id: '123456789',
      ml_access_token: 'mock_access_token_123',
      ml_refresh_token: 'mock_refresh_token_123',
      ml_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      created_at: new Date(),
      updated_at: new Date(),
      last_login: new Date()
    });

    this.users.set(2, {
      id: 2,
      email: 'seller@example.com',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBqvtMQPd5GMMK', // password123
      first_name: 'Test',
      last_name: 'Seller', 
      phone: '+5491987654321',
      ml_connected: true,
      ml_user_id: '987654321',
      ml_access_token: 'mock_access_token_456',
      ml_refresh_token: 'mock_refresh_token_456',
      ml_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      created_at: new Date(),
      updated_at: new Date(),
      last_login: new Date()
    });

    this.users.set(3, {
      id: 3,
      email: 'buyer@example.com',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBqvtMQPd5GMMK', // password123
      first_name: 'Test',
      last_name: 'Buyer',
      phone: '+5491555666777',
      ml_connected: false,
      ml_user_id: null,
      ml_access_token: null,
      ml_refresh_token: null,
      ml_token_expires_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      last_login: null
    });

    logger.info('Mock database initialized with test users');
  }

  async query(sql, params = []) {
    // Mock SQL queries
    logger.debug('Mock DB Query:', { sql, params });
    
    // Return mock results based on query type
    if (sql.includes('SELECT') && sql.includes('users')) {
      if (sql.includes('WHERE email =')) {
        const email = params[0];
        const user = Array.from(this.users.values()).find(u => u.email === email);
        return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      }
      if (sql.includes('WHERE id =')) {
        const id = parseInt(params[0]);
        const user = this.users.get(id);
        return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      }
      // Return all users for stats
      return { rows: Array.from(this.users.values()), rowCount: this.users.size };
    }

    if (sql.includes('INSERT INTO users')) {
      const newId = this.users.size + 1;
      const newUser = {
        id: newId,
        email: params[0],
        password: params[1],
        first_name: params[2] || null,
        last_name: params[3] || null,
        phone: params[4] || null,
        ml_connected: false,
        ml_user_id: null,
        created_at: new Date(),
        updated_at: new Date()
      };
      this.users.set(newId, newUser);
      return { rows: [newUser], rowCount: 1 };
    }

    if (sql.includes('UPDATE users')) {
      // Mock update - return success
      return { rows: [], rowCount: 1 };
    }

    // Default mock response
    return { rows: [], rowCount: 0 };
  }

  async getClient() {
    return {
      query: this.query.bind(this),
      release: () => {}
    };
  }

  async end() {
    logger.info('Mock database connection closed');
  }
}

module.exports = new MockDatabase();
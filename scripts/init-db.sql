-- ML Ecosystem - Database Initialization Script
-- PostgreSQL setup with test data

-- Create database if not exists (handled by docker-compose)
-- CREATE DATABASE ml_ecosystem;

-- Connect to the database
\c ml_ecosystem;

-- Create users table
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
);

-- Create products table (for caching ML products)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    ml_item_id VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(500),
    category_id VARCHAR(50),
    price DECIMAL(10,2),
    currency_id VARCHAR(10),
    available_quantity INTEGER,
    condition VARCHAR(20),
    listing_type_id VARCHAR(50),
    permalink VARCHAR(500),
    thumbnail VARCHAR(500),
    ml_data JSONB,
    last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255),
    requests_count INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    window_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    event_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_ml_user_id ON users(ml_user_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_ml_connected ON users(ml_connected);

CREATE INDEX IF NOT EXISTS idx_products_ml_item_id ON products(ml_item_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_last_sync ON products(last_sync);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at);

-- Insert test users
INSERT INTO users (email, password, first_name, last_name, phone, ml_connected, ml_user_id) VALUES
('demo@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBqvtMQPd5GMMK', 'Demo', 'User', '+5491123456789', true, '123456789'),
('seller@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBqvtMQPd5GMMK', 'Test', 'Seller', '+5491987654321', true, '987654321'),
('buyer@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBqvtMQPd5GMMK', 'Test', 'Buyer', '+5491555666777', false, NULL)
ON CONFLICT (email) DO NOTHING;

-- Insert test products
INSERT INTO products (ml_item_id, user_id, title, category_id, price, currency_id, available_quantity, condition, listing_type_id, permalink, thumbnail) VALUES
('MLA123456789', 1, 'iPhone 14 Pro Max 256GB', 'MLA1055', 899999.99, 'ARS', 5, 'new', 'gold_special', 'https://articulo.mercadolibre.com.ar/MLA123456789', 'https://http2.mlstatic.com/iphone.jpg'),
('MLA987654321', 1, 'Samsung Galaxy S23 Ultra', 'MLA1055', 749999.99, 'ARS', 3, 'new', 'gold_special', 'https://articulo.mercadolibre.com.ar/MLA987654321', 'https://http2.mlstatic.com/samsung.jpg'),
('MLA555666777', 2, 'MacBook Pro M2 13 pulgadas', 'MLA1648', 1299999.99, 'ARS', 2, 'new', 'gold_pro', 'https://articulo.mercadolibre.com.ar/MLA555666777', 'https://http2.mlstatic.com/macbook.jpg'),
('MLA111222333', 2, 'iPad Air 5ta generación', 'MLA1648', 549999.99, 'ARS', 8, 'new', 'gold_special', 'https://articulo.mercadolibre.com.ar/MLA111222333', 'https://http2.mlstatic.com/ipad.jpg')
ON CONFLICT (ml_item_id) DO NOTHING;

-- Insert sample analytics events
INSERT INTO analytics_events (event_type, user_id, event_data) VALUES
('user.login', 1, '{"ip": "192.168.1.100", "user_agent": "Mozilla/5.0..."}'),
('product.viewed', 1, '{"product_id": "MLA123456789", "price": 899999.99}'),
('product.updated', 1, '{"product_id": "MLA123456789", "old_quantity": 10, "new_quantity": 5}'),
('user.login', 2, '{"ip": "192.168.1.101", "user_agent": "Chrome/118.0..."}'),
('product.viewed', 2, '{"product_id": "MLA555666777", "price": 1299999.99}')
ON CONFLICT DO NOTHING;

-- Create views for analytics
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN ml_connected = TRUE THEN 1 END) as ml_connected_users,
    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_users_week,
    COUNT(CASE WHEN last_login >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as active_users_day,
    ROUND(
        (COUNT(CASE WHEN ml_connected = TRUE THEN 1 END)::decimal / COUNT(*)::decimal) * 100, 
        2
    ) as ml_connection_rate
FROM users 
WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW product_stats AS
SELECT 
    COUNT(*) as total_products,
    COUNT(DISTINCT user_id) as sellers_with_products,
    AVG(price) as avg_price,
    SUM(available_quantity) as total_inventory,
    COUNT(CASE WHEN available_quantity < 5 THEN 1 END) as low_stock_products
FROM products;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Output success message
\echo 'Database initialized successfully with test data!'
\echo 'Test users created:'
\echo '  - demo@example.com (password: password123)'
\echo '  - seller@example.com (password: password123)'  
\echo '  - buyer@example.com (password: password123)'
\echo 'Test products and analytics data inserted.'
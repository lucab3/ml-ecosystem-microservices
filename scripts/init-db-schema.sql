-- ML Ecosystem - Production Database Schema
-- PostgreSQL setup for REAL MercadoLibre integration
-- No test data - only structure and indexes

-- Connect to the database
\c ml_ecosystem;

-- =================== CORE TABLES ===================

-- Users table - stores app users and ML OAuth data
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    
    -- MercadoLibre Integration
    ml_connected BOOLEAN DEFAULT FALSE,
    ml_user_id VARCHAR(50) UNIQUE,
    ml_access_token TEXT,
    ml_refresh_token TEXT,
    ml_token_expires_at TIMESTAMP,
    ml_scopes TEXT,
    ml_user_data JSONB, -- Full ML user profile
    ml_connected_at TIMESTAMP,
    
    -- Audit fields
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Products table - cache of user's ML products for monitoring
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    ml_item_id VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Product details from ML
    title VARCHAR(500) NOT NULL,
    category_id VARCHAR(50),
    price DECIMAL(12,2),
    currency_id VARCHAR(10),
    available_quantity INTEGER,
    sold_quantity INTEGER DEFAULT 0,
    condition VARCHAR(20),
    listing_type_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    permalink VARCHAR(500),
    thumbnail VARCHAR(500),
    
    -- Raw ML data and sync info
    ml_data JSONB, -- Complete ML item response
    last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'synced', -- synced, error, pending
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock alerts table - track low stock notifications
CREATE TABLE IF NOT EXISTS stock_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    ml_item_id VARCHAR(50) NOT NULL,
    
    -- Alert details
    alert_type VARCHAR(20) NOT NULL, -- 'low_stock', 'out_of_stock', 'restock'
    threshold INTEGER,
    current_stock INTEGER,
    previous_stock INTEGER,
    severity VARCHAR(20) DEFAULT 'warning', -- 'critical', 'warning', 'info'
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'resolved', 'muted'
    resolved_at TIMESTAMP,
    notified_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table - JWT and session management
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(500) NOT NULL,
    jwt_token_hash VARCHAR(255), -- Hash of JWT for revocation
    
    -- Session metadata
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    
    -- Expiration
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rate limiting table - ML API usage tracking
CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    identifier VARCHAR(255) NOT NULL, -- user_id, ip, or 'global'
    endpoint VARCHAR(255),
    method VARCHAR(10),
    
    -- Rate limit tracking
    requests_count INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    window_end TIMESTAMP,
    limit_type VARCHAR(20) DEFAULT 'hourly', -- 'minute', 'hourly', 'daily'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics events table - business intelligence
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Event data
    event_data JSONB,
    metadata JSONB,
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System configuration table
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    description TEXT,
    is_sensitive BOOLEAN DEFAULT FALSE,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =================== INDEXES FOR PERFORMANCE ===================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_ml_user_id ON users(ml_user_id) WHERE ml_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_ml_connected ON users(ml_connected) WHERE ml_connected = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login) WHERE last_login IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_ml_item_id ON products(ml_item_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_available_quantity ON products(available_quantity);
CREATE INDEX IF NOT EXISTS idx_products_last_sync ON products(last_sync);
CREATE INDEX IF NOT EXISTS idx_products_sync_status ON products(sync_status);

-- Stock alerts indexes
CREATE INDEX IF NOT EXISTS idx_stock_alerts_user_id ON stock_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product_id ON stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_ml_item_id ON stock_alerts(ml_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_status ON stock_alerts(status);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_alert_type ON stock_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_created_at ON stock_alerts(created_at);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_jwt_hash ON user_sessions(jwt_token_hash) WHERE jwt_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON user_sessions(last_activity);

-- Rate limits indexes
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_id ON rate_limits(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON rate_limits(endpoint);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_session_id ON analytics_events(session_id) WHERE session_id IS NOT NULL;

-- =================== BUSINESS INTELLIGENCE VIEWS ===================

-- User statistics view
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN ml_connected = TRUE THEN 1 END) as ml_connected_users,
    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_users_week,
    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_users_month,
    COUNT(CASE WHEN last_login >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as active_users_day,
    COUNT(CASE WHEN last_login >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as active_users_week,
    ROUND(
        CASE WHEN COUNT(*) > 0 
        THEN (COUNT(CASE WHEN ml_connected = TRUE THEN 1 END)::decimal / COUNT(*)::decimal) * 100 
        ELSE 0 END, 2
    ) as ml_connection_rate_percent
FROM users 
WHERE deleted_at IS NULL;

-- Product statistics view
CREATE OR REPLACE VIEW product_stats AS
SELECT 
    COUNT(*) as total_products,
    COUNT(DISTINCT user_id) as sellers_with_products,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_products,
    COUNT(CASE WHEN available_quantity <= 5 AND status = 'active' THEN 1 END) as low_stock_products,
    COUNT(CASE WHEN available_quantity = 0 AND status = 'active' THEN 1 END) as out_of_stock_products,
    ROUND(AVG(price), 2) as avg_price,
    SUM(available_quantity) as total_inventory_units,
    ROUND(SUM(price * available_quantity), 2) as total_inventory_value,
    MAX(last_sync) as last_sync_time
FROM products;

-- Stock alerts summary view
CREATE OR REPLACE VIEW stock_alerts_summary AS
SELECT 
    COUNT(*) as total_alerts,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_alerts,
    COUNT(CASE WHEN alert_type = 'out_of_stock' AND status = 'active' THEN 1 END) as critical_alerts,
    COUNT(CASE WHEN alert_type = 'low_stock' AND status = 'active' THEN 1 END) as warning_alerts,
    COUNT(DISTINCT user_id) as users_with_alerts,
    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as alerts_last_24h
FROM stock_alerts;

-- =================== TRIGGERS ===================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP; 
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables that need it
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =================== INITIAL CONFIGURATION ===================

-- Insert default system configuration
INSERT INTO system_config (config_key, config_value, description) VALUES
('low_stock_threshold', '5', 'Default threshold for low stock alerts'),
('monitoring_interval_minutes', '30', 'How often to check stock levels'),
('max_products_per_user', '1000', 'Maximum products a user can monitor'),
('session_timeout_hours', '24', 'Default session timeout'),
('rate_limit_requests_per_hour', '1000', 'Default ML API rate limit per user per hour')
ON CONFLICT (config_key) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Output success message
\echo '✅ Production database schema initialized successfully!';
\echo '📊 Tables created: users, products, stock_alerts, user_sessions, rate_limits, analytics_events, system_config';
\echo '🔍 Indexes created for optimal performance';
\echo '📈 Business intelligence views created';
\echo '⚙️  Triggers and default configuration set';
\echo '';
\echo '🚀 Ready for production deployment with real MercadoLibre credentials!';
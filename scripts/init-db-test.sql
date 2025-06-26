-- ML Ecosystem - Test Database with Sample Data
-- PostgreSQL setup for DEVELOPMENT/TESTING with mock data
-- Includes structure + realistic test data

-- Connect to the database
\c ml_ecosystem;

-- =================== EXECUTE SCHEMA FIRST ===================
\i /docker-entrypoint-initdb.d/init-db-schema.sql

-- =================== TEST DATA INSERTION ===================

-- Insert test users (passwords: bcrypt hash of "password123")
INSERT INTO users (
    email, password, first_name, last_name, phone, 
    ml_connected, ml_user_id, ml_access_token, ml_refresh_token, 
    ml_token_expires_at, ml_scopes, ml_user_data, ml_connected_at, last_login
) VALUES
(
    'demo@example.com', 
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBqvtMQPd5GMMK', 
    'Demo', 'User', '+5491123456789', 
    true, '123456789', 'mock_access_token_demo', 'mock_refresh_token_demo',
    CURRENT_TIMESTAMP + INTERVAL '6 hours', 'read write',
    '{"id": 123456789, "nickname": "DEMO_USER", "email": "demo@mercadolibre.com", "country_id": "AR", "site_id": "MLA"}',
    CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 hour'
),
(
    'seller@example.com', 
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBqvtMQPd5GMMK', 
    'Test', 'Seller', '+5491987654321', 
    true, '987654321', 'mock_access_token_seller', 'mock_refresh_token_seller',
    CURRENT_TIMESTAMP + INTERVAL '6 hours', 'read write',
    '{"id": 987654321, "nickname": "TEST_SELLER", "email": "seller@mercadolibre.com", "country_id": "AR", "site_id": "MLA"}',
    CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '30 minutes'
),
(
    'buyer@example.com', 
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBqvtMQPd5GMMK', 
    'Test', 'Buyer', '+5491555666777', 
    false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 
    CURRENT_TIMESTAMP - INTERVAL '3 days'
)
ON CONFLICT (email) DO NOTHING;

-- Insert test products (matching mock API data structure)
INSERT INTO products (
    ml_item_id, user_id, title, category_id, price, currency_id, 
    available_quantity, sold_quantity, condition, listing_type_id, status,
    permalink, thumbnail, ml_data, last_sync, sync_status
) VALUES
(
    'MLA123456789', 1, 'iPhone 14 Pro Max 256GB - Titanio Natural', 'MLA1055', 
    1299999.99, 'ARS', 2, 45, 'new', 'gold_special', 'active',
    'https://www.mercadolibre.com.ar/demo-iphone', 
    'https://via.placeholder.com/200x200/007bff/ffffff?text=iPhone',
    '{"base_stock": 2, "variance": 3, "category_name": "Celulares y Telefones", "shipping": {"free_shipping": true}}',
    CURRENT_TIMESTAMP - INTERVAL '5 minutes', 'synced'
),
(
    'MLA987654321', 1, 'MacBook Pro 14" M3 512GB - Gris Espacial', 'MLA1648', 
    2499999.99, 'ARS', 0, 12, 'new', 'gold_pro', 'active',
    'https://www.mercadolibre.com.ar/demo-macbook', 
    'https://via.placeholder.com/200x200/28a745/ffffff?text=MacBook',
    '{"base_stock": 0, "variance": 2, "category_name": "Computacion", "shipping": {"free_shipping": true}}',
    CURRENT_TIMESTAMP - INTERVAL '3 minutes', 'synced'
),
(
    'MLA555666777', 1, 'Samsung Galaxy S24 Ultra 512GB - Titanio Negro', 'MLA1055', 
    899999.99, 'ARS', 15, 67, 'new', 'gold_special', 'active',
    'https://www.mercadolibre.com.ar/demo-samsung', 
    'https://via.placeholder.com/200x200/ffc107/000000?text=Galaxy',
    '{"base_stock": 15, "variance": 5, "category_name": "Celulares y Telefones", "shipping": {"free_shipping": true}}',
    CURRENT_TIMESTAMP - INTERVAL '7 minutes', 'synced'
),
(
    'MLA111222333', 1, 'PlayStation 5 Consola + 2 Joysticks', 'MLA1144', 
    649999.99, 'ARS', 3, 89, 'new', 'gold_special', 'active',
    'https://www.mercadolibre.com.ar/demo-ps5', 
    'https://via.placeholder.com/200x200/6f42c1/ffffff?text=PS5',
    '{"base_stock": 3, "variance": 4, "category_name": "Consolas y Videojuegos", "shipping": {"free_shipping": true}}',
    CURRENT_TIMESTAMP - INTERVAL '2 minutes', 'synced'
),
(
    'MLA444555666', 1, 'Nintendo Switch OLED 64GB + Mario Kart 8', 'MLA1144', 
    399999.99, 'ARS', 12, 156, 'new', 'gold_special', 'active',
    'https://www.mercadolibre.com.ar/demo-switch', 
    'https://via.placeholder.com/200x200/dc3545/ffffff?text=Switch',
    '{"base_stock": 12, "variance": 8, "category_name": "Consolas y Videojuegos", "shipping": {"free_shipping": true}}',
    CURRENT_TIMESTAMP - INTERVAL '1 minute', 'synced'
),
-- Products for second user
(
    'MLA777888999', 2, 'iPad Air 5ta generación 256GB WiFi', 'MLA1648', 
    549999.99, 'ARS', 1, 23, 'new', 'gold_special', 'active',
    'https://www.mercadolibre.com.ar/demo-ipad', 
    'https://via.placeholder.com/200x200/fd7e14/ffffff?text=iPad',
    '{"base_stock": 1, "variance": 2, "category_name": "Computacion", "shipping": {"free_shipping": true}}',
    CURRENT_TIMESTAMP - INTERVAL '4 minutes', 'synced'
),
(
    'MLA000111222', 2, 'AirPods Pro 2da generación', 'MLA1276', 
    199999.99, 'ARS', 8, 78, 'new', 'gold_special', 'active',
    'https://www.mercadolibre.com.ar/demo-airpods', 
    'https://via.placeholder.com/200x200/8b5cf6/ffffff?text=AirPods',
    '{"base_stock": 8, "variance": 3, "category_name": "Audio", "shipping": {"free_shipping": true}}',
    CURRENT_TIMESTAMP - INTERVAL '6 minutes', 'synced'
)
ON CONFLICT (ml_item_id) DO NOTHING;

-- Insert stock alerts for low stock products
INSERT INTO stock_alerts (
    user_id, product_id, ml_item_id, alert_type, threshold, 
    current_stock, previous_stock, severity, status, created_at
) VALUES
(1, 1, 'MLA123456789', 'low_stock', 5, 2, 4, 'warning', 'active', CURRENT_TIMESTAMP - INTERVAL '1 hour'),
(1, 2, 'MLA987654321', 'out_of_stock', 5, 0, 1, 'critical', 'active', CURRENT_TIMESTAMP - INTERVAL '30 minutes'),
(1, 4, 'MLA111222333', 'low_stock', 5, 3, 6, 'warning', 'active', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
(2, 6, 'MLA777888999', 'low_stock', 5, 1, 3, 'warning', 'active', CURRENT_TIMESTAMP - INTERVAL '45 minutes')
ON CONFLICT DO NOTHING;

-- Insert user sessions
INSERT INTO user_sessions (
    user_id, session_token, jwt_token_hash, ip_address, user_agent, 
    expires_at, last_activity, device_info
) VALUES
(1, 'session_demo_' || extract(epoch from now()), 'jwt_hash_demo', '192.168.1.100', 
 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 
 CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP,
 '{"browser": "Chrome", "os": "Windows", "device": "Desktop"}'),
(2, 'session_seller_' || extract(epoch from now()), 'jwt_hash_seller', '192.168.1.101', 
 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 
 CURRENT_TIMESTAMP + INTERVAL '24 hours', CURRENT_TIMESTAMP - INTERVAL '30 minutes',
 '{"browser": "Safari", "os": "macOS", "device": "Desktop"}')
ON CONFLICT DO NOTHING;

-- Insert rate limit records
INSERT INTO rate_limits (
    user_id, identifier, endpoint, method, requests_count, 
    window_start, window_end, limit_type
) VALUES
(1, '123456789', '/api/ml/user/products/monitoring', 'GET', 15, 
 CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP + INTERVAL '30 minutes', 'hourly'),
(1, '123456789', '/api/ml/items/*', 'GET', 45, 
 CURRENT_TIMESTAMP - INTERVAL '45 minutes', CURRENT_TIMESTAMP + INTERVAL '15 minutes', 'hourly'),
(2, '987654321', '/api/ml/user/products/monitoring', 'GET', 8, 
 CURRENT_TIMESTAMP - INTERVAL '20 minutes', CURRENT_TIMESTAMP + INTERVAL '40 minutes', 'hourly')
ON CONFLICT DO NOTHING;

-- Insert analytics events
INSERT INTO analytics_events (
    event_type, user_id, event_data, metadata, ip_address, user_agent, session_id
) VALUES
('user.login', 1, '{"success": true, "method": "password"}', '{"source": "web", "duration_ms": 1250}', '192.168.1.100', 'Chrome/118.0', 'session_demo'),
('user.ml_connected', 1, '{"ml_user_id": "123456789", "scopes": ["read", "write"]}', '{"oauth_duration_ms": 3200}', '192.168.1.100', 'Chrome/118.0', 'session_demo'),
('product.viewed', 1, '{"product_id": "MLA123456789", "price": 1299999.99}', '{"view_duration_ms": 45000}', '192.168.1.100', 'Chrome/118.0', 'session_demo'),
('alert.triggered', 1, '{"product_id": "MLA987654321", "alert_type": "out_of_stock", "severity": "critical"}', '{"notification_sent": true}', '192.168.1.100', 'Chrome/118.0', 'session_demo'),
('product.monitoring_updated', 1, '{"products_synced": 5, "alerts_generated": 3}', '{"sync_duration_ms": 2800}', '192.168.1.100', 'Chrome/118.0', 'session_demo'),
('user.login', 2, '{"success": true, "method": "password"}', '{"source": "web", "duration_ms": 980}', '192.168.1.101', 'Safari/537.36', 'session_seller'),
('product.viewed', 2, '{"product_id": "MLA777888999", "price": 549999.99}', '{"view_duration_ms": 30000}', '192.168.1.101', 'Safari/537.36', 'session_seller'),
('alert.triggered', 2, '{"product_id": "MLA777888999", "alert_type": "low_stock", "severity": "warning"}', '{"notification_sent": true}', '192.168.1.101', 'Safari/537.36', 'session_seller')
ON CONFLICT DO NOTHING;

-- =================== VERIFICATION QUERIES ===================

-- Show test data summary
\echo '';
\echo '📊 TEST DATA SUMMARY:';
\echo '===================';

-- Users summary
SELECT 
    '👥 Users: ' || COUNT(*) || ' total, ' || 
    COUNT(CASE WHEN ml_connected THEN 1 END) || ' connected to ML'
FROM users;

-- Products summary  
SELECT 
    '📦 Products: ' || COUNT(*) || ' total, ' || 
    COUNT(CASE WHEN available_quantity <= 5 THEN 1 END) || ' low stock'
FROM products;

-- Alerts summary
SELECT 
    '🚨 Alerts: ' || COUNT(*) || ' total, ' || 
    COUNT(CASE WHEN severity = 'critical' THEN 1 END) || ' critical'
FROM stock_alerts WHERE status = 'active';

-- Analytics summary
SELECT 
    '📈 Events: ' || COUNT(*) || ' total, ' || 
    COUNT(DISTINCT event_type) || ' different types'
FROM analytics_events;

\echo '';
\echo '🔑 TEST LOGIN CREDENTIALS:';
\echo '==========================';
\echo 'Email: demo@example.com     | Password: password123 | ML Connected: ✅';
\echo 'Email: seller@example.com   | Password: password123 | ML Connected: ✅';  
\echo 'Email: buyer@example.com    | Password: password123 | ML Connected: ❌';
\echo '';
\echo '📱 TEST PRODUCTS (User: demo@example.com):';
\echo '==========================================';
\echo '• iPhone 14 Pro Max (2 units) - ⚠️  LOW STOCK';
\echo '• MacBook Pro M3 (0 units) - 🚨 OUT OF STOCK';  
\echo '• Samsung Galaxy S24 (15 units) - ✅ OK';
\echo '• PlayStation 5 (3 units) - ⚠️  LOW STOCK';
\echo '• Nintendo Switch (12 units) - ✅ OK';
\echo '';
\echo '✅ Test database initialized successfully!';
\echo '🚀 Ready for development and testing!';
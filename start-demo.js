// Simple startup script
const express = require('express');

console.log('🚀 Starting ML Ecosystem Demo...\n');

// Mock ML API
const mlApp = express();
mlApp.use(express.json());

// Enable CORS for all services
const cors = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
};

mlApp.use(cors);

mlApp.get('/health', (req, res) => {
  console.log('📡 Mock ML API health check requested');
  res.json({status: 'ok', service: 'mock-ml-api', timestamp: new Date().toISOString()});
});

mlApp.get('/sites/MLA', (req, res) => {
  console.log('📡 Mock ML API sites request');
  res.json({ id: 'MLA', name: 'Argentina', currency: 'ARS' });
});

// Dynamic stock simulation - changes every 2 minutes
const dynamicStock = {
  'MLA123456789': { base: 2, variance: 3 },   // iPhone: 0-5 stock
  'MLA987654321': { base: 0, variance: 2 },   // MacBook: 0-2 stock  
  'MLA555666777': { base: 15, variance: 5 },  // Samsung: 10-20 stock
  'MLA111222333': { base: 3, variance: 4 },   // PS5: 0-7 stock
  'MLA444555666': { base: 12, variance: 8 }   // Switch: 4-20 stock
};

// Update stock every 2 minutes (120 seconds)
setInterval(() => {
  Object.keys(dynamicStock).forEach(itemId => {
    const config = dynamicStock[itemId];
    const randomVariance = Math.floor(Math.random() * (config.variance * 2)) - config.variance;
    const newStock = Math.max(0, config.base + randomVariance);
    dynamicStock[itemId].currentStock = newStock;
    
    console.log(`📦 Stock updated: ${itemId} -> ${newStock} units`);
  });
}, 120000); // 2 minutes

// Initialize current stock
Object.keys(dynamicStock).forEach(itemId => {
  dynamicStock[itemId].currentStock = dynamicStock[itemId].base;
});

mlApp.post('/oauth/token', (req, res) => {
  console.log('📡 Mock ML API OAuth token request');
  res.json({ 
    access_token: 'mock_access_token_' + Date.now(), 
    token_type: 'Bearer',
    expires_in: 21600,
    scope: 'read',
    user_id: 123456789,
    refresh_token: 'mock_refresh_token_' + Date.now()
  });
});

// Mock user info endpoint
mlApp.get('/users/me', (req, res) => {
  console.log('📡 Mock ML API user info request');
  res.json({
    id: 123456789,
    nickname: 'DEMO_SELLER',
    email: 'demo.seller@mercadolibre.com',
    first_name: 'Demo',
    last_name: 'Seller',
    country_id: 'AR',
    site_id: 'MLA'
  });
});

// Mock user items endpoint
mlApp.get('/users/:userId/items/search', (req, res) => {
  console.log('📡 Mock ML API user items request for user:', req.params.userId);
  
  // Mock product IDs
  const mockProducts = [
    'MLA123456789', // iPhone - Dynamic stock
    'MLA987654321', // MacBook - Dynamic stock
    'MLA555666777', // Samsung - Dynamic stock
    'MLA111222333', // PS5 - Dynamic stock
    'MLA444555666'  // Switch - Dynamic stock
  ];
  
  res.json({
    site_id: 'MLA',
    results: mockProducts,
    paging: {
      total: mockProducts.length,
      offset: 0,
      limit: 50
    }
  });
});

// Mock individual item details with dynamic stock
mlApp.get('/items/:itemId', (req, res) => {
  console.log('📡 Mock ML API item detail request for:', req.params.itemId);
  
  // Base mock data
  const mockItems = {
    'MLA123456789': {
      id: 'MLA123456789',
      title: 'iPhone 14 Pro Max 256GB - Titanio Natural',
      price: 1299999,
      currency_id: 'ARS',
      sold_quantity: 45 + Math.floor(Date.now() / 300000), // Slowly increasing sales
      status: 'active',
      condition: 'new',
      category_id: 'MLA1055',
      permalink: 'https://www.mercadolibre.com.ar/demo-iphone',
      thumbnail: 'https://via.placeholder.com/200x200/007bff/ffffff?text=iPhone'
    },
    'MLA987654321': {
      id: 'MLA987654321', 
      title: 'MacBook Pro 14" M3 512GB - Gris Espacial',
      price: 2499999,
      currency_id: 'ARS',
      sold_quantity: 12 + Math.floor(Date.now() / 600000), // Slower sales
      status: 'active',
      condition: 'new',
      category_id: 'MLA1648',
      permalink: 'https://www.mercadolibre.com.ar/demo-macbook',
      thumbnail: 'https://via.placeholder.com/200x200/28a745/ffffff?text=MacBook'
    },
    'MLA555666777': {
      id: 'MLA555666777',
      title: 'Samsung Galaxy S24 Ultra 512GB - Titanio Negro',
      price: 899999,
      currency_id: 'ARS', 
      sold_quantity: 67 + Math.floor(Date.now() / 200000), // Fast sales
      status: 'active',
      condition: 'new',
      category_id: 'MLA1055',
      permalink: 'https://www.mercadolibre.com.ar/demo-samsung',
      thumbnail: 'https://via.placeholder.com/200x200/ffc107/000000?text=Galaxy'
    },
    'MLA111222333': {
      id: 'MLA111222333',
      title: 'PlayStation 5 Consola + 2 Joysticks',
      price: 649999,
      currency_id: 'ARS',
      sold_quantity: 89 + Math.floor(Date.now() / 250000), // Medium sales 
      status: 'active',
      condition: 'new',
      category_id: 'MLA1144',
      permalink: 'https://www.mercadolibre.com.ar/demo-ps5',
      thumbnail: 'https://via.placeholder.com/200x200/6f42c1/ffffff?text=PS5'
    },
    'MLA444555666': {
      id: 'MLA444555666',
      title: 'Nintendo Switch OLED 64GB + Mario Kart 8',
      price: 399999,
      currency_id: 'ARS',
      sold_quantity: 156 + Math.floor(Date.now() / 180000), // Fast sales
      status: 'active', 
      condition: 'new',
      category_id: 'MLA1144',
      permalink: 'https://www.mercadolibre.com.ar/demo-switch',
      thumbnail: 'https://via.placeholder.com/200x200/dc3545/ffffff?text=Switch'
    }
  };
  
  const item = mockItems[req.params.itemId];
  if (item) {
    // Add dynamic stock to the item
    item.available_quantity = dynamicStock[req.params.itemId]?.currentStock || 0;
    
    console.log(`📦 Item ${req.params.itemId}: ${item.available_quantity} units available`);
    res.json(item);
  } else {
    res.status(404).json({ error: 'Item not found' });
  }
});

const mlServer = mlApp.listen(3333, () => {
  console.log('✅ Mock ML API started on http://localhost:3333');
});

// User Service
const userApp = express();
userApp.use(express.json());
userApp.use(cors);

const users = new Map([
  ['demo@example.com', { id: 1, email: 'demo@example.com', first_name: 'Demo', last_name: 'User' }],
  ['seller@example.com', { id: 2, email: 'seller@example.com', first_name: 'Test', last_name: 'Seller' }]
]);

userApp.get('/health', (req, res) => {
  console.log('👤 User Service health check requested');
  res.json({
    status: 'healthy',
    service: 'user-service',
    timestamp: new Date().toISOString(),
    database: 'mock',
    users_count: users.size
  });
});

userApp.get('/api/users', (req, res) => {
  console.log('👤 User Service - listing users');
  res.json({
    success: true,
    data: Array.from(users.values()),
    total: users.size
  });
});

userApp.post('/api/auth/register', (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  console.log(`👤 User Service - register attempt for: ${email}`);
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  if (users.has(email)) {
    return res.status(409).json({ error: 'User already exists' });
  }
  
  const user = { 
    id: users.size + 1, 
    email, 
    firstName: firstName || 'Demo', 
    lastName: lastName || 'User',
    mlConnected: false
  };
  users.set(email, user);
  
  const token = 'mock_jwt_token_' + Date.now();
  
  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: { 
      userId: user.id, 
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      token,
      mlConnected: false
    }
  });
});

// Mock login endpoint
userApp.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  console.log(`👤 User Service - login attempt for: ${email}`);
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  // For demo, accept any password for existing users
  const user = users.get(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = 'mock_jwt_token_' + Date.now();
  
  res.json({
    success: true,
    message: 'Login successful',
    data: {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      token,
      mlConnected: user.mlConnected || false,
      mlUserId: user.mlUserId
    }
  });
});

// Mock logout endpoint
userApp.post('/api/auth/logout', (req, res) => {
  console.log('👤 User Service - logout');
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Mock ML connect endpoint
userApp.get('/api/auth/ml/connect', (req, res) => {
  console.log('👤 User Service - ML connect request');
  res.json({
    success: true,
    authUrl: 'http://localhost:3333/oauth/authorize?client_id=mock&redirect_uri=http://localhost:3001/auth/callback',
    state: 'mock_state_' + Date.now()
  });
});

// Mock ML callback endpoint  
userApp.post('/api/auth/ml/callback', (req, res) => {
  console.log('👤 User Service - ML callback');
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code required' });
  }
  
  // Check if user is authorized (demo user 123456789 is in authorized list)
  const mlUserId = '123456789';
  const authorizedUsers = process.env.AUTHORIZED_ML_USERS?.split(',').map(id => id.trim()) || ['123456789'];
  
  if (!authorizedUsers.includes(mlUserId)) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Tu cuenta de MercadoLibre no está autorizada para usar esta aplicación.'
    });
  }
  
  res.json({
    success: true,
    message: 'MercadoLibre account connected successfully',
    data: {
      mlUserId: 123456789,
      mlUserData: {
        id: 123456789,
        nickname: 'DEMO_SELLER',
        email: 'demo.seller@mercadolibre.com',
        firstName: 'Demo',
        lastName: 'Seller',
        country: 'AR',
        site: 'MLA'
      },
      scopes: ['read']
    }
  });
});

// Mock users/me endpoint for token validation
userApp.get('/api/users/me', (req, res) => {
  console.log('👤 User Service - get current user');
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  // For demo, return mock user data
  res.json({
    id: 1,
    email: 'demo@example.com',
    firstName: 'Demo',
    lastName: 'User',
    mlConnected: true,
    mlUserId: 123456789
  });
});

const userServer = userApp.listen(3001, () => {
  console.log('✅ User Service started on http://localhost:3001');
});

// Integration Service
const integrationApp = express();
integrationApp.use(express.json());
integrationApp.use(cors);

integrationApp.get('/health', (req, res) => {
  console.log('🔌 Integration Service health check requested');
  res.json({
    status: 'healthy',
    service: 'integration-service',
    timestamp: new Date().toISOString(),
    ml_api: 'connected'
  });
});

integrationApp.get('/api/ml/sites/MLA', async (req, res) => {
  console.log('🔌 Integration Service - ML sites request');
  try {
    const response = await fetch('http://localhost:3333/sites/MLA');
    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    res.status(503).json({ error: 'ML API unavailable' });
  }
});

// Mock product monitoring endpoint
integrationApp.get('/api/ml/user/products/monitoring', async (req, res) => {
  console.log('🔌 Integration Service - product monitoring request');
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // Get user's products from ML API
    const productsResponse = await fetch('http://localhost:3333/users/123456789/items/search');
    const productsData = await productsResponse.json();
    
    if (!productsData.results || productsData.results.length === 0) {
      return res.json({
        success: true,
        data: {
          totalProducts: 0,
          lowStockProducts: [],
          alertCount: 0,
          message: 'No active products found'
        }
      });
    }
    
    // Get details for each product
    const lowStockThreshold = parseInt(process.env.LOW_STOCK_THRESHOLD) || 5;
    const productDetails = [];
    const lowStockProducts = [];
    
    for (const productId of productsData.results) {
      try {
        const detailResponse = await fetch(`http://localhost:3333/items/${productId}`);
        const detail = await detailResponse.json();
        
        const productInfo = {
          id: detail.id,
          title: detail.title,
          permalink: detail.permalink,
          thumbnail: detail.thumbnail,
          price: detail.price,
          currency_id: detail.currency_id,
          available_quantity: detail.available_quantity,
          sold_quantity: detail.sold_quantity,
          status: detail.status,
          condition: detail.condition,
          category_id: detail.category_id
        };
        
        productDetails.push(productInfo);
        
        // Check for low stock
        if (detail.available_quantity <= lowStockThreshold && detail.status === 'active') {
          lowStockProducts.push({
            ...productInfo,
            stockAlert: {
              currentStock: detail.available_quantity,
              threshold: lowStockThreshold,
              severity: detail.available_quantity === 0 ? 'critical' : 'warning'
            }
          });
        }
        
      } catch (error) {
        console.warn('Error fetching product detail:', productId, error.message);
      }
    }
    
    const monitoringData = {
      userId: 1,
      mlUserId: 123456789,
      totalProducts: productDetails.length,
      activeProducts: productDetails.filter(p => p.status === 'active').length,
      lowStockProducts,
      alertCount: lowStockProducts.length,
      lowStockThreshold,
      lastUpdated: new Date().toISOString(),
      summary: {
        criticalStock: lowStockProducts.filter(p => p.stockAlert.severity === 'critical').length,
        warningStock: lowStockProducts.filter(p => p.stockAlert.severity === 'warning').length,
        totalValue: productDetails.reduce((sum, p) => sum + (p.price * p.available_quantity), 0)
      }
    };
    
    if (lowStockProducts.length > 0) {
      console.log(`🚨 Low stock alert: ${lowStockProducts.length} products need attention`);
      lowStockProducts.forEach(p => {
        console.log(`   - ${p.title}: ${p.stockAlert.currentStock} units (${p.stockAlert.severity})`);
      });
    }
    
    res.json({
      success: true,
      cached: false,
      data: monitoringData
    });
    
  } catch (error) {
    console.error('Product monitoring error:', error);
    res.status(500).json({
      error: 'Monitoring failed',
      message: 'Failed to fetch product monitoring data'
    });
  }
});

// Mock product alerts endpoint
integrationApp.get('/api/ml/user/products/alerts', async (req, res) => {
  console.log('🔌 Integration Service - product alerts request');
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // Get monitoring data
    const monitoringResponse = await fetch('http://localhost:3002/api/ml/user/products/monitoring', {
      headers: { Authorization: req.headers.authorization }
    });
    const monitoringData = await monitoringResponse.json();
    
    const lowStockProducts = monitoringData.data?.lowStockProducts || [];
    
    res.json({
      success: true,
      data: {
        alertCount: lowStockProducts.length,
        criticalCount: lowStockProducts.filter(p => p.stockAlert.severity === 'critical').length,
        warningCount: lowStockProducts.filter(p => p.stockAlert.severity === 'warning').length,
        alerts: lowStockProducts,
        lastUpdated: monitoringData.data?.lastUpdated,
        threshold: monitoringData.data?.lowStockThreshold
      }
    });
    
  } catch (error) {
    console.error('Product alerts error:', error);
    res.status(500).json({
      error: 'Alerts fetch failed',
      message: 'Failed to fetch product alerts'
    });
  }
});

const integrationServer = integrationApp.listen(3002, () => {
  console.log('✅ Integration Service started on http://localhost:3002');
});

// Frontend Server
const path = require('path');
const frontendApp = express();
frontendApp.use(cors);

// Serve static files from frontend directory
frontendApp.use(express.static(path.join(__dirname, 'frontend')));

// API endpoint for product monitoring (demo)
frontendApp.post('/api/monitor', (req, res) => {
  console.log('📊 Frontend - product monitoring request:', req.body);
  res.json({
    success: true,
    message: 'Product added to monitoring',
    data: req.body
  });
});

frontendApp.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'frontend-server',
    timestamp: new Date().toISOString()
  });
});

const frontendServer = frontendApp.listen(3000, () => {
  console.log('✅ Frontend Server started on http://localhost:3000');
});

console.log('\n🎉 All services are running!');
console.log('\n🌐 ML Stock Monitor Frontend: http://localhost:3000');
console.log('\n📋 API Endpoints:');
console.log('   curl http://localhost:3333/health');
console.log('   curl http://localhost:3001/health');
console.log('   curl http://localhost:3002/health');
console.log('   curl http://localhost:3000/health');
console.log('   curl http://localhost:3001/api/users');
console.log('\n📦 Stock Monitoring:');
console.log('   - Stock changes every 2 minutes automatically');
console.log('   - Low stock threshold: 5 units');
console.log('   - Watch console for stock updates');
console.log('\n🔑 Demo Login:');
console.log('   Email: demo@example.com');
console.log('   Password: any password works');
console.log('\n⏹️  Press Ctrl+C to stop all services\n');

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down all services...');
  mlServer.close();
  userServer.close();
  integrationServer.close();
  frontendServer.close();
  console.log('✅ All services stopped');
  process.exit(0);
});
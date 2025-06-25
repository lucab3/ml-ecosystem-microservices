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

mlApp.post('/oauth/token', (req, res) => {
  console.log('📡 Mock ML API OAuth token request');
  res.json({ 
    access_token: 'mock_access_token_' + Date.now(), 
    token_type: 'Bearer',
    expires_in: 21600
  });
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
  const { email, password } = req.body;
  console.log(`👤 User Service - register attempt for: ${email}`);
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  if (users.has(email)) {
    return res.status(409).json({ error: 'User already exists' });
  }
  
  const user = { id: users.size + 1, email, first_name: '', last_name: '' };
  users.set(email, user);
  
  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: { id: user.id, email: user.email }
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
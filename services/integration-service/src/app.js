const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/mlRateLimiter');
const mlRoutes = require('./routes/ml-api');
const healthRoutes = require('./routes/health');
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/circuitBreaker');
const circuitBreaker = require('./middleware/circuitBreaker');

const app = express();

// =================== MIDDLEWARE DE SEGURIDAD ===================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

app.use(compression());

// =================== RATE LIMITING AGRESIVO ===================
// Este servicio maneja llamadas a ML API, necesita rate limiting más estricto
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // 100 requests por minuto por IP
  message: {
    error: 'Too many requests to ML API',
    retryAfter: '1 minute',
    service: 'integration-service'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health'
});

app.use('/api/', limiter);

// =================== PARSING ===================
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// =================== LOGGING ===================
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http('API Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      service: 'integration-service'
    });
  });
  
  next();
});

// =================== CIRCUIT BREAKER GLOBAL ===================
app.use('/api/ml/', circuitBreaker);

// =================== RUTAS ===================
app.use('/health', healthRoutes);

// Todas las rutas ML requieren autenticación
app.use('/api/ml', authMiddleware, mlRoutes);

// =================== ERROR HANDLING ===================
app.use(errorHandler);

// =================== 404 HANDLER ===================
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    service: 'integration-service',
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
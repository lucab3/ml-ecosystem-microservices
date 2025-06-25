const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const prometheus = require('prom-client');

const logger = require('./utils/logger');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const healthRoutes = require('./routes/health');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { metricsMiddleware } = require('./middleware/metrics');

const app = express();

// =================== MIDDLEWARE DE SEGURIDAD ===================
app.use(helmet({
  contentSecurityPolicy: false, // Para desarrollo
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

app.use(compression());

// =================== RATE LIMITING ===================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 1000 requests por IP por ventana
  message: {
    error: 'Too many requests',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Saltear rate limiting para health checks
    return req.path === '/health';
  }
});

app.use('/api/', limiter);

// =================== PARSING ===================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =================== MÉTRICAS ===================
app.use(metricsMiddleware);

// =================== LOGGING ===================
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  
  next();
});

// =================== RUTAS ===================
app.use('/health', healthRoutes);
app.get('/metrics', async (req, res) => {
  try {
    const { getMetrics } = require('./middleware/metrics');
    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    res.status(500).send('Error collecting metrics');
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// =================== ERROR HANDLING ===================
app.use(errorHandler);

// =================== 404 HANDLER ===================
app.use('*', notFoundHandler);

module.exports = app;
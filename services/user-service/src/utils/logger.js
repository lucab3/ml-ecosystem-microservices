const winston = require('winston');

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Formato custom para desarrollo
const developmentFormat = printf(({ level, message, timestamp, service, ...meta }) => {
  let log = `${timestamp} [${service || 'user-service'}] ${level}: ${message}`;
  
  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta, null, 2)}`;
  }
  
  return log;
});

// Configurar logger según el entorno
const createLogger = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const baseFormat = [
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    errors({ stack: true })
  ];

  const transports = [];

  if (isDevelopment) {
    // En desarrollo: logs coloridos en consola
    transports.push(
      new winston.transports.Console({
        format: combine(
          colorize(),
          ...baseFormat,
          developmentFormat
        )
      })
    );
  } else {
    // En producción: JSON estructurado
    transports.push(
      new winston.transports.Console({
        format: combine(
          ...baseFormat,
          json()
        )
      })
    );
  }

  // Archivo de logs para errores (solo en producción o si se especifica)
  if (isProduction || process.env.LOG_TO_FILE === 'true') {
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: combine(...baseFormat, json())
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: combine(...baseFormat, json())
      })
    );
  }

  return winston.createLogger({
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    defaultMeta: { 
      service: process.env.SERVICE_NAME || 'user-service',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    },
    transports,
    // No salir del proceso en errores
    exitOnError: false
  });
};

const logger = createLogger();

// Wrapper para manejar objetos complejos
const createLoggerMethods = (logger) => {
  return {
    error: (message, meta = {}) => {
      if (typeof message === 'object') {
        logger.error('Error occurred', { error: message, ...meta });
      } else {
        logger.error(message, meta);
      }
    },
    
    warn: (message, meta = {}) => {
      logger.warn(message, meta);
    },
    
    info: (message, meta = {}) => {
      logger.info(message, meta);
    },
    
    debug: (message, meta = {}) => {
      logger.debug(message, meta);
    },
    
    // Método especial para logs de HTTP requests
    http: (message, meta = {}) => {
      logger.info(message, { type: 'http', ...meta });
    },

    // Método especial para métricas
    metric: (message, meta = {}) => {
      logger.info(message, { type: 'metric', ...meta });
    },

    // Método especial para eventos de negocio
    event: (message, meta = {}) => {
      logger.info(message, { type: 'business_event', ...meta });
    },

    // Método para logs de performance
    performance: (message, meta = {}) => {
      logger.info(message, { type: 'performance', ...meta });
    },

    // Método para logs de seguridad
    security: (message, meta = {}) => {
      logger.warn(message, { type: 'security', ...meta });
    }
  };
};

// Stream para Morgan (logging de HTTP requests)
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Manejo de errores del logger
logger.on('error', (error) => {
  console.error('Logger error:', error);
});

module.exports = createLoggerMethods(logger);
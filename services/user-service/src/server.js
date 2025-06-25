require('dotenv').config();

const app = require('./app');
const logger = require('./utils/logger');
const database = require('./config/database');
const redis = require('./config/redis');

const PORT = process.env.PORT || 3001;
const SERVICE_NAME = process.env.SERVICE_NAME || 'user-service';

// =================== INICIALIZACIÓN ===================
async function startServer() {
  try {
    // Use mock services in development
    const useMockServices = process.env.USE_MOCK_DB === 'true' || process.env.NODE_ENV === 'development';
    
    if (useMockServices) {
      logger.info('🧪 Using mock services for development');
      logger.info('✅ Mock database ready');
      logger.info('✅ Mock Redis ready');
    } else {
      // Conectar a PostgreSQL
      logger.info('🔗 Conectando a PostgreSQL...');
      await database.connect();
      logger.info('✅ PostgreSQL conectado');

      // Conectar a Redis
      logger.info('🔗 Conectando a Redis...');
      await redis.connect();
      logger.info('✅ Redis conectado');

      // Inicializar tablas si no existen
      await database.initTables();
      logger.info('✅ Tablas de base de datos inicializadas');
    }

    // Iniciar servidor
    const server = app.listen(PORT, () => {
      logger.info(`🚀 ${SERVICE_NAME} iniciado en puerto ${PORT}`, {
        service: SERVICE_NAME,
        port: PORT,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      });
    });

    // Manejo de cierre limpio
    const gracefulShutdown = async (signal) => {
      logger.info(`📡 Señal ${signal} recibida. Iniciando cierre limpio...`);
      
      server.close(async () => {
        logger.info('🔌 Servidor HTTP cerrado');
        
        if (!useMockServices) {
          try {
            await database.disconnect();
            logger.info('🔌 PostgreSQL desconectado');
          } catch (error) {
            logger.error('❌ Error cerrando PostgreSQL:', error);
          }

          try {
            await redis.disconnect();
            logger.info('🔌 Redis desconectado');
          } catch (error) {
            logger.error('❌ Error cerrando Redis:', error);
          }
        } else {
          logger.info('🔌 Mock services disconnected');
        }

        logger.info('👋 Cierre limpio completado');
        process.exit(0);
      });

      // Forzar cierre después de 30 segundos
      setTimeout(() => {
        logger.error('⚠️ Forzando cierre después de 30s');
        process.exit(1);
      }, 30000);
    };

    // Manejadores de señales
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Manejo de errores no capturados
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled Rejection:', { reason, promise });
      process.exit(1);
    });

  } catch (error) {
    logger.error('💥 Error iniciando servidor:', error);
    process.exit(1);
  }
}

// =================== ARRANQUE ===================
if (require.main === module) {
  startServer();
}

module.exports = { startServer };
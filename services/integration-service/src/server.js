require('dotenv').config();

const app = require('./app');
const logger = require('./utils/logger');
const redis = require('./config/redis');

const PORT = process.env.PORT || 3002;
const SERVICE_NAME = process.env.SERVICE_NAME || 'integration-service';

// =================== INICIALIZACIÓN ===================
async function startServer() {
  try {
    // Conectar a Redis
    logger.info('🔗 Conectando a Redis...');
    await redis.connect();
    logger.info('✅ Redis conectado');

    // Verificar modo Mock
    const mockMode = process.env.MOCK_ML_API === 'true';
    if (mockMode) {
      logger.info('🎭 Iniciando en modo MOCK - sin conectar a ML API real');
    } else {
      logger.info('🔐 Iniciando en modo REAL - conectando a MercadoLibre API');
    }

    // Iniciar servidor
    const server = app.listen(PORT, () => {
      logger.info(`🚀 ${SERVICE_NAME} iniciado en puerto ${PORT}`, {
        service: SERVICE_NAME,
        port: PORT,
        environment: process.env.NODE_ENV,
        mockMode: mockMode,
        timestamp: new Date().toISOString()
      });
    });

    // Manejo de cierre limpio
    const gracefulShutdown = async (signal) => {
      logger.info(`📡 Señal ${signal} recibida. Iniciando cierre limpio...`);
      
      server.close(async () => {
        logger.info('🔌 Servidor HTTP cerrado');
        
        try {
          await redis.disconnect();
          logger.info('🔌 Redis desconectado');
        } catch (error) {
          logger.error('❌ Error cerrando Redis:', error);
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
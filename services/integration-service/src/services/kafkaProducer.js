const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

class KafkaProducer {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'integration-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });
    
    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000
    });
    
    this.isConnected = false;
    this.topics = {
      ML_EVENTS: 'ml-events',
      INVENTORY_EVENTS: 'inventory-events',
      ANALYTICS_EVENTS: 'analytics-events',
      NOTIFICATION_EVENTS: 'notification-events'
    };
  }

  async connect() {
    try {
      await this.producer.connect();
      this.isConnected = true;
      logger.info('✅ Kafka Producer connected (Integration Service)');
    } catch (error) {
      this.isConnected = false;
      logger.error('❌ Kafka Producer connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.producer.disconnect();
      this.isConnected = false;
      logger.info('👋 Kafka Producer disconnected (Integration Service)');
    } catch (error) {
      logger.error('❌ Kafka Producer disconnect error:', error);
    }
  }

  async sendEvent(eventType, payload, options = {}) {
    if (!this.isConnected) {
      logger.warn('Kafka Producer not connected, attempting to connect...');
      try {
        await this.connect();
      } catch (error) {
        logger.error('Failed to connect Kafka Producer for event sending');
        return false;
      }
    }

    try {
      const {
        topic = this.getTopicForEvent(eventType),
        key = null,
        partition = null,
        headers = {}
      } = options;

      const message = {
        key: key || payload.userId?.toString() || payload.itemId || null,
        value: JSON.stringify({
          eventType,
          payload,
          timestamp: Date.now(),
          service: 'integration-service',
          version: '1.0'
        }),
        headers: {
          'content-type': 'application/json',
          'event-type': eventType,
          'service': 'integration-service',
          ...headers
        }
      };

      if (partition !== null) {
        message.partition = partition;
      }

      await this.producer.send({
        topic,
        messages: [message]
      });

      logger.debug('Event sent to Kafka', {
        topic,
        eventType,
        key: message.key,
        payloadSize: message.value.length
      });

      return true;

    } catch (error) {
      logger.error('Failed to send event to Kafka:', {
        error: error.message,
        eventType,
        payload
      });
      return false;
    }
  }

  getTopicForEvent(eventType) {
    if (eventType.startsWith('ml.') || eventType.startsWith('product.')) {
      return this.topics.ML_EVENTS;
    } else if (eventType.startsWith('stock.') || eventType.startsWith('inventory.')) {
      return this.topics.INVENTORY_EVENTS;
    } else if (eventType.startsWith('analytics.') || eventType.startsWith('metric.')) {
      return this.topics.ANALYTICS_EVENTS;
    } else if (eventType.startsWith('notification.') || eventType.startsWith('alert.')) {
      return this.topics.NOTIFICATION_EVENTS;
    }
    
    return this.topics.ML_EVENTS; // Default
  }

  // High-level event methods for better semantics
  async sendMLAPIEvent(eventType, payload) {
    return this.sendEvent(eventType, payload, {
      topic: this.topics.ML_EVENTS,
      headers: {
        'ml-api-call': 'true',
        'api-version': 'v1'
      }
    });
  }

  async sendStockUpdateEvent(payload) {
    return this.sendEvent('stock.updated', payload, {
      topic: this.topics.INVENTORY_EVENTS,
      key: payload.itemId,
      headers: {
        'stock-change': payload.change?.toString(),
        'critical': payload.newQuantity < 5 ? 'true' : 'false'
      }
    });
  }

  async sendProductViewEvent(payload) {
    return this.sendEvent('product.viewed', payload, {
      topic: this.topics.ANALYTICS_EVENTS,
      key: payload.itemId
    });
  }

  async sendLowStockAlert(payload) {
    return this.sendEvent('alert.low_stock', payload, {
      topic: this.topics.NOTIFICATION_EVENTS,
      key: payload.itemId,
      headers: {
        'priority': 'high',
        'alert-type': 'low-stock'
      }
    });
  }

  async sendRateLimitAlert(payload) {
    return this.sendEvent('alert.rate_limit', payload, {
      topic: this.topics.NOTIFICATION_EVENTS,
      headers: {
        'priority': 'medium',
        'alert-type': 'rate-limit'
      }
    });
  }

  async sendCircuitBreakerEvent(payload) {
    return this.sendEvent('ml.circuit_breaker', payload, {
      topic: this.topics.ML_EVENTS,
      headers: {
        'priority': 'high',
        'circuit-state': payload.state
      }
    });
  }

  // Batch events for high-throughput scenarios
  async sendBatchEvents(events) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const messagesByTopic = {};

      events.forEach(({ eventType, payload, options = {} }) => {
        const topic = options.topic || this.getTopicForEvent(eventType);
        
        if (!messagesByTopic[topic]) {
          messagesByTopic[topic] = [];
        }

        messagesByTopic[topic].push({
          key: options.key || payload.userId?.toString() || payload.itemId || null,
          value: JSON.stringify({
            eventType,
            payload,
            timestamp: Date.now(),
            service: 'integration-service',
            version: '1.0'
          }),
          headers: {
            'content-type': 'application/json',
            'event-type': eventType,
            'service': 'integration-service',
            ...options.headers
          }
        });
      });

      const sendPromises = Object.entries(messagesByTopic).map(([topic, messages]) =>
        this.producer.send({ topic, messages })
      );

      await Promise.all(sendPromises);

      logger.info('Batch events sent to Kafka', {
        totalEvents: events.length,
        topics: Object.keys(messagesByTopic)
      });

      return true;

    } catch (error) {
      logger.error('Failed to send batch events to Kafka:', error);
      return false;
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected) {
        return {
          status: 'unhealthy',
          connected: false,
          error: 'Producer not connected'
        };
      }

      const metadata = await this.kafka.admin().getTopicMetadata({
        topics: Object.values(this.topics)
      });

      return {
        status: 'healthy',
        connected: true,
        topics: metadata.topics.map(t => ({
          name: t.name,
          partitions: t.partitions.length
        }))
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        connected: this.isConnected,
        error: error.message
      };
    }
  }

  async gracefulShutdown() {
    logger.info('Kafka Producer graceful shutdown initiated');
    
    try {
      await this.producer.flush({ timeout: 10000 });
      await this.disconnect();
      logger.info('Kafka Producer graceful shutdown completed');
    } catch (error) {
      logger.error('Error during Kafka Producer graceful shutdown:', error);
    }
  }
}

// Export singleton instance
const kafkaProducer = new KafkaProducer();

// Graceful shutdown handling
process.on('SIGTERM', () => kafkaProducer.gracefulShutdown());
process.on('SIGINT', () => kafkaProducer.gracefulShutdown());

module.exports = kafkaProducer;
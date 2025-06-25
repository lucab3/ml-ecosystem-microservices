const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

class KafkaProducer {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'user-service',
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
      USER_EVENTS: 'user-events',
      ML_EVENTS: 'ml-events',
      AUDIT_EVENTS: 'audit-events'
    };
  }

  async connect() {
    try {
      await this.producer.connect();
      this.isConnected = true;
      logger.info('✅ Kafka Producer connected (User Service)');
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
      logger.info('👋 Kafka Producer disconnected (User Service)');
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
        key: key || payload.userId?.toString() || null,
        value: JSON.stringify({
          eventType,
          payload,
          timestamp: Date.now(),
          service: 'user-service',
          version: '1.0'
        }),
        headers: {
          'content-type': 'application/json',
          'event-type': eventType,
          'service': 'user-service',
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
    if (eventType.startsWith('user.')) {
      return this.topics.USER_EVENTS;
    } else if (eventType.startsWith('ml.')) {
      return this.topics.ML_EVENTS;
    } else if (eventType.startsWith('audit.')) {
      return this.topics.AUDIT_EVENTS;
    }
    
    return this.topics.USER_EVENTS; // Default
  }

  // Specific event methods for better type safety
  async sendUserEvent(eventType, payload) {
    return this.sendEvent(eventType, payload, {
      topic: this.topics.USER_EVENTS
    });
  }

  async sendMLEvent(eventType, payload) {
    return this.sendEvent(eventType, payload, {
      topic: this.topics.ML_EVENTS
    });
  }

  async sendAuditEvent(eventType, payload) {
    return this.sendEvent(eventType, payload, {
      topic: this.topics.AUDIT_EVENTS
    });
  }

  // Batch sending for high throughput scenarios
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
          key: options.key || payload.userId?.toString() || null,
          value: JSON.stringify({
            eventType,
            payload,
            timestamp: Date.now(),
            service: 'user-service',
            version: '1.0'
          }),
          headers: {
            'content-type': 'application/json',
            'event-type': eventType,
            'service': 'user-service',
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

      // Try to get metadata as a health check
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

  // Graceful shutdown
  async gracefulShutdown() {
    logger.info('Kafka Producer graceful shutdown initiated');
    
    try {
      // Wait for any pending messages to be sent
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

module.exports = {
  sendKafkaEvent: (eventType, payload, options) => 
    kafkaProducer.sendEvent(eventType, payload, options),
  sendUserEvent: (eventType, payload) => 
    kafkaProducer.sendUserEvent(eventType, payload),
  sendMLEvent: (eventType, payload) => 
    kafkaProducer.sendMLEvent(eventType, payload),
  sendAuditEvent: (eventType, payload) => 
    kafkaProducer.sendAuditEvent(eventType, payload),
  sendBatchEvents: (events) => 
    kafkaProducer.sendBatchEvents(events),
  healthCheck: () => 
    kafkaProducer.healthCheck(),
  connect: () => 
    kafkaProducer.connect(),
  disconnect: () => 
    kafkaProducer.disconnect(),
  kafkaProducer
};
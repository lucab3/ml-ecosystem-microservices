// Mock Kafka Producer for Development
const logger = require('../utils/logger');

class MockKafkaProducer {
  constructor() {
    this.connected = false;
    this.events = [];
  }

  async connect() {
    this.connected = true;
    logger.info('Mock Kafka producer connected');
  }

  async send({ topic, messages }) {
    if (!this.connected) {
      throw new Error('Kafka producer not connected');
    }

    // Mock sending messages
    messages.forEach(message => {
      const event = {
        topic,
        partition: 0,
        offset: this.events.length,
        timestamp: Date.now(),
        key: message.key,
        value: typeof message.value === 'string' ? message.value : JSON.stringify(message.value)
      };
      
      this.events.push(event);
      
      logger.info('Mock Kafka event sent', {
        topic,
        key: message.key,
        eventNumber: this.events.length
      });
    });

    return [{ 
      topicName: topic, 
      partition: 0, 
      errorCode: 0,
      offset: this.events.length - 1
    }];
  }

  async disconnect() {
    this.connected = false;
    logger.info('Mock Kafka producer disconnected');
  }

  // Helper method to get all events (for testing)
  getEvents() {
    return this.events;
  }

  // Helper method to clear events (for testing)
  clearEvents() {
    this.events = [];
  }
}

const mockProducer = new MockKafkaProducer();

const sendKafkaEvent = async (eventType, data) => {
  try {
    if (!mockProducer.connected) {
      await mockProducer.connect();
    }

    await mockProducer.send({
      topic: 'user-events',
      messages: [{
        key: eventType,
        value: {
          event: eventType,
          data,
          timestamp: Date.now(),
          service: 'user-service'
        }
      }]
    });

  } catch (error) {
    logger.error('Failed to send Kafka event:', error);
    // Don't throw in development mode
  }
};

module.exports = {
  sendKafkaEvent,
  mockProducer
};
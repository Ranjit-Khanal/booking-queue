const express = require('express');
const cors = require('cors');
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

// Kafka configuration
const kafka = new Kafka({
  clientId: 'booking-kafka-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

const producer = kafka.producer();
const TOPIC = 'booking-events';
const DLQ_TOPIC = 'booking-events-dlq';

// Message store (in production, use Redis or database)
const messageStore = new Map();

// Initialize Kafka producer
async function initializeKafka() {
  try {
    await producer.connect();
    console.log('✅ Kafka producer connected');

    // Create topics if they don't exist (requires Kafka admin)
    const admin = kafka.admin();
    await admin.connect();
    
    const topics = [
      {
        topic: TOPIC,
        numPartitions: 3,
        replicationFactor: 1
      },
      {
        topic: DLQ_TOPIC,
        numPartitions: 1,
        replicationFactor: 1
      }
    ];

    await admin.createTopics({
      topics: topics,
      waitForLeaders: true
    });

    await admin.disconnect();
    console.log('✅ Kafka topics created/verified');
  } catch (error) {
    if (error.message.includes('TopicExistsException')) {
      console.log('ℹ️  Kafka topics already exist');
    } else {
      console.error('Error initializing Kafka:', error.message);
    }
  }
}

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    const connected = producer.isConnected;
    res.json({ 
      status: 'ok', 
      service: 'kafka-service',
      topic: TOPIC,
      kafka: connected ? 'connected' : 'disconnected'
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Send message to Kafka topic
app.post('/messages', async (req, res) => {
  try {
    const { type, data } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: 'Missing type or data' });
    }

    const messageId = uuidv4();
    const message = {
      type,
      messageId,
      ...data,
      createdAt: new Date().toISOString()
    };

    // Determine partition based on bookingId or userId for ordering
    const partition = data.bookingId 
      ? parseInt(data.bookingId.slice(-1), 16) % 3 
      : Math.floor(Math.random() * 3);

    // Send to Kafka
    const result = await producer.send({
      topic: TOPIC,
      messages: [{
        key: messageId,
        value: JSON.stringify(message),
        partition: partition
      }]
    });

    // Store message metadata
    messageStore.set(messageId, {
      messageId,
      topic: TOPIC,
      partition: result[0].partition,
      offset: result[0].offset,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      messageId,
      topic: TOPIC,
      partition: result[0].partition,
      offset: result[0].offset,
      status: 'queued'
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message', message: error.message });
  }
});

// Get message status
app.get('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const metadata = messageStore.get(messageId);

    if (!metadata) {
      return res.status(404).json({ error: 'Message not found in metadata store' });
    }

    res.json({
      messageId,
      ...metadata,
      status: 'queued'
    });
  } catch (error) {
    console.error('Error getting message:', error);
    res.status(500).json({ error: 'Failed to get message', message: error.message });
  }
});

// Get topic statistics
app.get('/stats', async (req, res) => {
  try {
    const admin = kafka.admin();
    await admin.connect();

    const metadata = await admin.fetchTopicMetadata({ topics: [TOPIC, DLQ_TOPIC] });
    await admin.disconnect();

    const topicInfo = metadata.topics.find(t => t.name === TOPIC);
    const dlqInfo = metadata.topics.find(t => t.name === DLQ_TOPIC);

    res.json({
      topic: TOPIC,
      stats: {
        partitions: topicInfo ? topicInfo.partitions.length : 0,
        dlqPartitions: dlqInfo ? dlqInfo.partitions.length : 0,
        messagesInStore: messageStore.size
      }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats', message: error.message });
  }
});

// Initialize on startup
initializeKafka().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await producer.disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Kafka Service running on port ${PORT}`);
  console.log(`📦 Topic: ${TOPIC}`);
  console.log(`🔗 Kafka Broker: ${process.env.KAFKA_BROKER || 'localhost:9092'}`);
});


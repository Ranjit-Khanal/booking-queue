import express, { Request, Response } from 'express';
import cors from 'cors';
import { Kafka, Producer, Admin } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { BookingData, KafkaMessageMetadata } from '../../shared/types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || '3003';

// Kafka configuration
const kafka = new Kafka({
  clientId: 'booking-kafka-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

const producer: Producer = kafka.producer();
const TOPIC = 'booking-events';
const DLQ_TOPIC = 'booking-events-dlq';

interface MessageRequest {
  type: string;
  data: BookingData;
}

// Message store (in production, use Redis or database)
const messageStore = new Map<string, KafkaMessageMetadata>();

// Initialize Kafka producer
async function initializeKafka(): Promise<void> {
  try {
    await producer.connect();
    console.log('✅ Kafka producer connected');

    // Create topics if they don't exist (requires Kafka admin)
    const admin: Admin = kafka.admin();
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
    const err = error as Error;
    if (err.message.includes('TopicExistsException')) {
      console.log('ℹ️  Kafka topics already exist');
    } else {
      console.error('Error initializing Kafka:', err.message);
    }
  }
}

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const connected = producer.isConnected();
    res.json({ 
      status: 'ok', 
      service: 'kafka-service',
      topic: TOPIC,
      kafka: connected ? 'connected' : 'disconnected'
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Send message to Kafka topic
app.post('/messages', async (req: Request<{}, KafkaMessageMetadata, MessageRequest>, res: Response) => {
  try {
    const { type, data } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: 'Missing type or data' } as any);
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
    const metadata: KafkaMessageMetadata = {
      messageId,
      topic: TOPIC,
      partition: result[0].partition,
      offset: result[0].offset,
      timestamp: new Date().toISOString()
    };
    
    messageStore.set(messageId, metadata);

    res.status(201).json({
      ...metadata,
      status: 'queued'
    } as any);
  } catch (error) {
    const err = error as Error;
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message', message: err.message } as any);
  }
});

// Get message status
app.get('/messages/:messageId', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const metadata = messageStore.get(messageId);

    if (!metadata) {
      return res.status(404).json({ error: 'Message not found in metadata store' });
    }

    res.json({
      ...metadata,
      status: 'queued'
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error getting message:', err);
    res.status(500).json({ error: 'Failed to get message', message: err.message } as any);
  }
});

// Get topic statistics
app.get('/stats', async (_req: Request, res: Response) => {
  try {
    const admin: Admin = kafka.admin();
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
    const err = error as Error;
    console.error('Error getting stats:', err);
    res.status(500).json({ error: 'Failed to get stats', message: err.message } as any);
  }
});

// Initialize on startup
initializeKafka().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await producer.disconnect();
  process.exit(0);
});

app.listen(parseInt(PORT), () => {
  console.log(`🚀 Kafka Service running on port ${PORT}`);
  console.log(`📦 Topic: ${TOPIC}`);
  console.log(`🔗 Kafka Broker: ${process.env.KAFKA_BROKER || 'localhost:9092'}`);
});


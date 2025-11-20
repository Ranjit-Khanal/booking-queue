import express, { Request, Response } from 'express';
import cors from 'cors';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { BookingData, StreamMessage } from '../../shared/types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || '3002';

// Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

const STREAM_NAME = 'booking-stream';
const DLQ_STREAM_NAME = 'booking-stream-dlq';

interface MessageRequest {
  type: string;
  data: BookingData;
}

// Initialize consumer group if it doesn't exist
async function initializeConsumerGroup(): Promise<void> {
  try {
    await redis.xgroup('CREATE', STREAM_NAME, 'booking-workers', '0', 'MKSTREAM');
    console.log('✅ Consumer group "booking-workers" created');
  } catch (error) {
    const err = error as Error;
    if (err.message.includes('BUSYGROUP')) {
      console.log('ℹ️  Consumer group "booking-workers" already exists');
    } else {
      console.error('Error creating consumer group:', err);
    }
  }

  try {
    await redis.xgroup('CREATE', DLQ_STREAM_NAME, 'dlq-workers', '0', 'MKSTREAM');
    console.log('✅ DLQ consumer group created');
  } catch (error) {
    const err = error as Error;
    if (err.message.includes('BUSYGROUP')) {
      console.log('ℹ️  DLQ consumer group already exists');
    }
  }
}

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await redis.info('server');
    res.json({ 
      status: 'ok', 
      service: 'stream-service',
      stream: STREAM_NAME,
      redis: 'connected'
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Add message to stream (XADD)
app.post('/messages', async (req: Request<{}, StreamMessage, MessageRequest>, res: Response) => {
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

    // XADD to stream
    const streamId = await redis.xadd(
      STREAM_NAME,
      '*', // Auto-generate ID
      'type', type,
      'messageId', messageId,
      'data', JSON.stringify(message)
    ) as string;

    res.status(201).json({
      messageId,
      streamId,
      stream: STREAM_NAME,
      status: 'queued'
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error adding message:', err);
    res.status(500).json({ error: 'Failed to add message', message: err.message } as any);
  }
});

// Get message status (check if it exists in stream)
app.get('/messages/:messageId', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;

    // Read from stream and find message
    const messages = await redis.xrange(STREAM_NAME, '-', '+', 'COUNT', 1000) as Array<[string, string[]]>;
    
    const found = messages.find(([id, fields]) => {
      const dataIndex = fields.indexOf('data');
      if (dataIndex !== -1 && dataIndex < fields.length - 1) {
        try {
          const data = JSON.parse(fields[dataIndex + 1]);
          return data.messageId === messageId;
        } catch (e) {
          return false;
        }
      }
      return false;
    });

    if (!found) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const [streamId, fields] = found;
    const dataIndex = fields.indexOf('data');
    const messageData = dataIndex !== -1 ? JSON.parse(fields[dataIndex + 1]) : null;

    res.json({
      messageId,
      streamId,
      data: messageData,
      status: 'found'
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error getting message:', err);
    res.status(500).json({ error: 'Failed to get message', message: err.message } as any);
  }
});

// Get stream statistics
app.get('/stats', async (_req: Request, res: Response) => {
  try {
    const length = await redis.xlen(STREAM_NAME);
    const dlqLength = await redis.xlen(DLQ_STREAM_NAME);

    // Get pending messages count for consumer group
    const pendingInfo = await redis.xpending(STREAM_NAME, 'booking-workers') as [string, string, string, string] | null;
    const pendingCount = pendingInfo ? parseInt(pendingInfo[0]) : 0;

    res.json({
      stream: STREAM_NAME,
      stats: {
        totalMessages: length,
        pendingMessages: pendingCount,
        dlqMessages: dlqLength
      }
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error getting stats:', err);
    res.status(500).json({ error: 'Failed to get stats', message: err.message } as any);
  }
});

// Read messages from stream (for testing)
app.get('/messages', async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 10;
    const messages = await redis.xrange(STREAM_NAME, '-', '+', 'COUNT', count) as Array<[string, string[]]>;

    const formatted = messages.map(([id, fields]) => {
      const result: Record<string, any> = { streamId: id };
      for (let i = 0; i < fields.length; i += 2) {
        result[fields[i]] = fields[i + 1];
      }
      if (result.data) {
        try {
          result.data = JSON.parse(result.data as string);
        } catch (e) {
          // Keep as string if not JSON
        }
      }
      return result;
    });

    res.json({
      stream: STREAM_NAME,
      count: formatted.length,
      messages: formatted
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error reading messages:', err);
    res.status(500).json({ error: 'Failed to read messages', message: err.message } as any);
  }
});

// Initialize on startup
redis.on('connect', () => {
  console.log('✅ Connected to Redis');
  initializeConsumerGroup();
});

app.listen(parseInt(PORT), async () => {
  console.log(`🚀 Stream Service (Redis Streams) running on port ${PORT}`);
  console.log(`📦 Stream: ${STREAM_NAME}`);
  console.log(`🔗 Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`);
  
  // Initialize consumer groups
  await initializeConsumerGroup();
});


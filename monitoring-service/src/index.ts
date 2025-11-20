import express, { Request, Response } from 'express';
import cors from 'cors';
import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { Kafka, Admin } from 'kafkajs';
import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';
import { DashboardData, HealthStatus } from '../../shared/types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || '3004';

// Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

const bookingQueue = new Queue('booking-queue', { connection: redis });

// Kafka admin
const kafka = new Kafka({
  clientId: 'monitoring-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'monitoring-service' });
});

// Get dashboard data (all queue stats)
app.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    // BullMQ stats
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      bookingQueue.getWaitingCount(),
      bookingQueue.getActiveCount(),
      bookingQueue.getCompletedCount(),
      bookingQueue.getFailedCount(),
      bookingQueue.getDelayedCount()
    ]);

    // Redis Streams stats
    const streamLength = await redis.xlen('booking-stream');
    const dlqStreamLength = await redis.xlen('booking-stream-dlq');
    const pendingInfo = await redis.xpending('booking-stream', 'booking-workers') as [string, string, string, string] | null;
    const pendingCount = pendingInfo ? parseInt(pendingInfo[0]) : 0;

    // Kafka stats (simplified)
    const admin: Admin = kafka.admin();
    await admin.connect();
    const metadata = await admin.fetchTopicMetadata({ topics: ['booking-events', 'booking-events-dlq'] });
    await admin.disconnect();

    const bookingTopic = metadata.topics.find(t => t.name === 'booking-events');
    const dlqTopic = metadata.topics.find(t => t.name === 'booking-events-dlq');

    const dashboardData: DashboardData = {
      timestamp: new Date().toISOString(),
      queues: {
        bullmq: {
          waiting,
          active,
          completed,
          failed,
          delayed,
          total: waiting + active + completed + failed + delayed
        },
        redisStreams: {
          totalMessages: streamLength,
          pendingMessages: pendingCount,
          dlqMessages: dlqStreamLength
        },
        kafka: {
          topic: 'booking-events',
          partitions: bookingTopic ? bookingTopic.partitions.length : 0,
          dlqPartitions: dlqTopic ? dlqTopic.partitions.length : 0
        }
      }
    };

    res.json(dashboardData);
  } catch (error) {
    const err = error as Error;
    console.error('Error getting dashboard data:', err);
    res.status(500).json({ error: 'Failed to get dashboard data', message: err.message } as any);
  }
});

// Get BullMQ queue details
app.get('/queue/bullmq', async (_req: Request, res: Response) => {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      bookingQueue.getWaiting(0, 9),
      bookingQueue.getActive(0, 9),
      bookingQueue.getCompleted(0, 9),
      bookingQueue.getFailed(0, 9),
      bookingQueue.getDelayed(0, 9)
    ]);

    res.json({
      queue: 'booking-queue',
      waiting: waiting.map((j: Job) => ({ id: j.id, name: j.name, data: j.data })),
      active: active.map((j: Job) => ({ id: j.id, name: j.name, data: j.data, progress: j.progress })),
      completed: completed.map((j: Job) => ({ id: j.id, name: j.name, returnvalue: j.returnvalue })),
      failed: failed.map((j: Job) => ({ id: j.id, name: j.name, failedReason: j.failedReason })),
      delayed: delayed.map((j: Job) => ({ id: j.id, name: j.name, delay: (j as any).delay }))
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: 'Failed to get BullMQ queue data', message: err.message } as any);
  }
});

// Get Redis Streams details
app.get('/queue/streams', async (_req: Request, res: Response) => {
  try {
    const length = await redis.xlen('booking-stream');
    const messages = await redis.xrange('booking-stream', '-', '+', 'COUNT', 10) as Array<[string, string[]]>;
    const pendingInfo = await redis.xpending('booking-stream', 'booking-workers', '-', '+', 10) as Array<[string, string, string, string]> | null;

    res.json({
      stream: 'booking-stream',
      totalMessages: length,
      recentMessages: messages.map(([id, fields]) => {
        const result: Record<string, any> = { streamId: id };
        for (let i = 0; i < fields.length; i += 2) {
          result[fields[i]] = fields[i + 1];
        }
        return result;
      }),
      pendingMessages: pendingInfo || []
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: 'Failed to get Redis Streams data', message: err.message } as any);
  }
});

// Get service health status
app.get('/services/health', async (_req: Request, res: Response) => {
  const services = [
    { name: 'api-service', url: 'http://api-service:3000/health' },
    { name: 'queue-service', url: 'http://queue-service:3001/health' },
    { name: 'stream-service', url: 'http://stream-service:3002/health' },
    { name: 'kafka-service', url: 'http://kafka-service:3003/health' }
  ];

  const healthChecks = await Promise.allSettled(
    services.map(async (service) => {
      try {
        const response = await axios.get(service.url, { timeout: 2000 });
        return { ...service, status: 'healthy', data: response.data };
      } catch (error) {
        const err = error as AxiosError;
        return { ...service, status: 'unhealthy', error: err.message };
      }
    })
  );

  res.json({
    timestamp: new Date().toISOString(),
    services: healthChecks.map((result, index) => 
      result.status === 'fulfilled' ? result.value : { ...services[index], status: 'error' }
    )
  });
});

app.listen(parseInt(PORT), () => {
  console.log(`🚀 Monitoring Service running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
});


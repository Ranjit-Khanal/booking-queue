import { Request, Response } from 'express';
import { bookingQueue, kafka, redis } from '..';
import { Admin } from 'kafkajs';
import { DashboardData } from 'src/types/global.types';

export const dashboard = async (_req: Request, res: Response) => {
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
    let metadata;
    try {
      await admin.connect();
      metadata = await admin.fetchTopicMetadata({
        topics: ['booking-events', 'booking-events-dlq'],
      });
    } finally {
      await admin.disconnect();
    }

    const bookingTopic = metadata.topics.find(t => t.name === 'booking-events');
    const dlqTopic = metadata.topics.find(t => t.name === 'booking-events-dlq');

    const bookingPartitions = bookingTopic?.partitions?.length ?? 0;;
    const dlqPartitions = dlqTopic?.partitions?.length ?? 0;
    ;

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
          partitions: bookingPartitions,
          dlqPartitions: dlqPartitions
        }
      }
    };

    res.json(dashboardData);
  } catch (error) {
    const err = error as Error;
    console.error('Error getting dashboard data:', err);
    res.status(500).json({ error: 'Failed to get dashboard data', message: err.message } as any);
  }
}
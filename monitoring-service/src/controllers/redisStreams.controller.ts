import { Request, Response } from 'express';
import { redis } from '..';
    export const getRedisStreamsData = async (_req: Request, res: Response) => {
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
}
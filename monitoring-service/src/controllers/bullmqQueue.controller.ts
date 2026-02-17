import { Job } from 'bullmq';
import { Request, Response } from 'express';
import { bookingQueue } from '..';

 export const getBullMQQueueData = async (_req: Request, res: Response) => {
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
}
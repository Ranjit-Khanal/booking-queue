import axios from 'axios';
import { Request, Response } from 'express';
import { KAFKA_SERVICE_URL, QUEUE_SERVICE_URL, STREAM_SERVICE_URL } from '../index';

 export const getBookingStatus=   async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const [bullmqStatus, streamsStatus, kafkaStatus] = await Promise.allSettled([
      axios.get(`${QUEUE_SERVICE_URL}/jobs/${bookingId}`).catch(() => ({ data: null })),
      axios.get(`${STREAM_SERVICE_URL}/messages/${bookingId}`).catch(() => ({ data: null })),
      axios.get(`${KAFKA_SERVICE_URL}/messages/${bookingId}`).catch(() => ({ data: null }))
    ]);

   return res.json({
      bookingId,
      status: {
        bullmq: bullmqStatus.status === 'fulfilled' ? bullmqStatus.value.data : null,
        redisStreams: streamsStatus.status === 'fulfilled' ? streamsStatus.value.data : null,
        kafka: kafkaStatus.status === 'fulfilled' ? kafkaStatus.value.data : null
      }
    });
  } catch (error) {
    const err = error as Error;
   return res.status(500).json({ error: 'Failed to get booking status', message: err.message } as any);
  }
}
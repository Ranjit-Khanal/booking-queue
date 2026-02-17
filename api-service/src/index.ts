import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { BookingData,BookingResponse,QueueResponse } from '../shared/index';

dotenv.config();

const app = express();
const PORT = process.env.PORT || '3000';

// Service URLs
const QUEUE_SERVICE_URL = process.env.QUEUE_SERVICE_URL || 'http://localhost:3001';
const STREAM_SERVICE_URL = process.env.STREAM_SERVICE_URL || 'http://localhost:3002';
const KAFKA_SERVICE_URL = process.env.KAFKA_SERVICE_URL || 'http://localhost:3003';

app.use(cors());
app.use(express.json());

interface BookingRequest {
  userId: string;
  hotelId: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  roomType?: string;
}

interface DelayedBookingRequest extends BookingRequest {
  delaySeconds?: number;
}

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'api-service' });
});

// Create booking - publishes to all three queue types
app.post('/api/bookings', async (req: Request<{}, BookingResponse, BookingRequest>, res: Response) => {
  try {
    const { userId, hotelId, checkIn, checkOut, guests, roomType } = req.body;

    // Validation
    if (!userId || !hotelId || !checkIn || !checkOut) {
      return res.status(400).json({
        error: 'Missing required fields: userId, hotelId, checkIn, checkOut'
      } as any);
    }

    const bookingId = uuidv4();
    const bookingData: BookingData = {
      bookingId,
      userId,
      hotelId,
      checkIn,
      checkOut,
      guests: guests || 1,
      roomType: roomType || 'standard',
      createdAt: new Date().toISOString()
    };

    // Publish to all three queue systems in parallel
    const [bullmqResult, streamsResult, kafkaResult] = await Promise.allSettled([
      axios.post(`${QUEUE_SERVICE_URL}/jobs`, {
        type: 'booking',
        data: bookingData,
        options: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          },
          removeOnComplete: true,
          removeOnFail: false
        }
      }),
      axios.post(`${STREAM_SERVICE_URL}/messages`, {
        type: 'booking',
        data: bookingData
      }),
      axios.post(`${KAFKA_SERVICE_URL}/messages`, {
        type: 'booking',
        data: bookingData
      })
    ]);

    const results: BookingResponse = {
      bookingId,
      queues: {
        bullmq: bullmqResult.status === 'fulfilled' 
          ? { jobId: bullmqResult.value.data.jobId, status: 'queued' } as QueueResponse
          : { error: (bullmqResult as PromiseRejectedResult).reason?.message || 'Unknown error', status: 'error' } as QueueResponse,
        redisStreams: streamsResult.status === 'fulfilled'
          ? { messageId: streamsResult.value.data.messageId, status: 'queued' } as QueueResponse
          : { error: (streamsResult as PromiseRejectedResult).reason?.message || 'Unknown error', status: 'error' } as QueueResponse,
        kafka: kafkaResult.status === 'fulfilled'
          ? { messageId: kafkaResult.value.data.messageId, status: 'queued' } as QueueResponse
          : { error: (kafkaResult as PromiseRejectedResult).reason?.message || 'Unknown error', status: 'error' } as QueueResponse
      }
    };

   return res.status(201).json(results);
  } catch (error) {
    const err = error as Error;
    console.error('Error creating booking:', err);
   return res.status(500).json({ error: 'Failed to create booking', message: err.message } as any);
  }
});

// Get booking status (from all queues)
app.get('/api/bookings/:bookingId/status', async (req: Request, res: Response) => {
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
});

// Create delayed booking (for testing delayed jobs)
app.post('/api/bookings/delayed', async (req: Request<{}, any, DelayedBookingRequest>, res: Response) => {
  try {
    const { userId, hotelId, checkIn, checkOut, delaySeconds = 10 } = req.body;

    if (!userId || !hotelId || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const bookingId = uuidv4();
    const bookingData: BookingData = {
      bookingId,
      userId,
      hotelId,
      checkIn,
      checkOut,
      createdAt: new Date().toISOString()
    };

    // Only BullMQ supports delayed jobs natively
    const result = await axios.post(`${QUEUE_SERVICE_URL}/jobs/delayed`, {
      type: 'booking',
      data: bookingData,
      delay: delaySeconds * 1000 // Convert to milliseconds
    });

   return res.status(201).json({
      bookingId,
      delaySeconds,
      jobId: result.data.jobId,
      message: `Booking will be processed in ${delaySeconds} seconds`
    });
  } catch (error) {
    const err = error as Error;
    return res.status(500).json({ error: 'Failed to create delayed booking', message: err.message } as any);
  }
});

app.listen(parseInt(PORT), () => {
  console.log(`🚀 API Service running on port ${PORT}`);
  console.log(`📡 Queue Service: ${QUEUE_SERVICE_URL}`);
  console.log(`📡 Stream Service: ${STREAM_SERVICE_URL}`);
  console.log(`📡 Kafka Service: ${KAFKA_SERVICE_URL}`);
});


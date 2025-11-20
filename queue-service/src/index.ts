import express, { Request, Response } from 'express';
import cors from 'cors';
import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { BookingData, JobData, QueueJobOptions, JobStatus } from '../../shared/types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || '3001';

// Redis connection
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

// Create BullMQ queue
const bookingQueue = new Queue('booking-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000
    },
    removeOnFail: {
      age: 24 * 3600 // Keep failed jobs for 24 hours
    }
  }
});

app.use(cors());
app.use(express.json());

interface AddJobRequest {
  type: string;
  data: BookingData;
  options?: QueueJobOptions;
}

interface DelayedJobRequest {
  type: string;
  data: BookingData;
  delay: number;
}

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'queue-service', queue: 'booking-queue' });
});

// Add job to queue
app.post('/jobs', async (req: Request<{}, any, AddJobRequest>, res: Response) => {
  try {
    const { type, data, options = {} } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: 'Missing type or data' });
    }

    const jobId = uuidv4();
    const job = await bookingQueue.add(
      type,
      {
        ...data,
        jobId,
        createdAt: new Date().toISOString()
      } as BookingData,
      {
        jobId,
        ...options
      }
    );

    res.status(201).json({
      jobId: job.id,
      name: job.name,
      data: job.data,
      status: 'queued'
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error adding job:', err);
    res.status(500).json({ error: 'Failed to add job', message: err.message });
  }
});

// Add delayed job
app.post('/jobs/delayed', async (req: Request<{}, any, DelayedJobRequest>, res: Response) => {
  try {
    const { type, data, delay } = req.body;

    if (!type || !data || !delay) {
      return res.status(400).json({ error: 'Missing type, data, or delay' });
    }

    const jobId = uuidv4();
    const job = await bookingQueue.add(
      type,
      {
        ...data,
        jobId,
        createdAt: new Date().toISOString()
      } as BookingData,
      {
        jobId,
        delay,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    );

    res.status(201).json({
      jobId: job.id,
      name: job.name,
      delay: delay,
      scheduledFor: new Date(Date.now() + delay).toISOString(),
      status: 'scheduled'
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error adding delayed job:', err);
    res.status(500).json({ error: 'Failed to add delayed job', message: err.message });
  }
});

// Get job status
app.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await bookingQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();
    const progress = job.progress;
    const returnvalue = job.returnvalue;
    const failedReason = job.failedReason;

    const jobStatus: JobStatus = {
      jobId: job.id!,
      name: job.name,
      state,
      progress: typeof progress === 'number' ? progress : undefined,
      data: job.data,
      returnvalue,
      failedReason: failedReason || undefined,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp
    };

    res.json(jobStatus);
  } catch (error) {
    const err = error as Error;
    console.error('Error getting job:', err);
    res.status(500).json({ error: 'Failed to get job', message: err.message });
  }
});

// Get queue statistics
app.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      bookingQueue.getWaitingCount(),
      bookingQueue.getActiveCount(),
      bookingQueue.getCompletedCount(),
      bookingQueue.getFailedCount(),
      bookingQueue.getDelayedCount()
    ]);

    res.json({
      queue: 'booking-queue',
      stats: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed
      }
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error getting stats:', err);
    res.status(500).json({ error: 'Failed to get stats', message: err.message });
  }
});

// Get jobs by state
app.get('/jobs/state/:state', async (req: Request, res: Response) => {
  try {
    const { state } = req.params;
    const start = parseInt(req.query.start as string) || 0;
    const end = parseInt(req.query.end as string) || 9;

    let jobs: Job[] = [];
    switch (state) {
      case 'waiting':
        jobs = await bookingQueue.getWaiting(start, end);
        break;
      case 'active':
        jobs = await bookingQueue.getActive(start, end);
        break;
      case 'completed':
        jobs = await bookingQueue.getCompleted(start, end);
        break;
      case 'failed':
        jobs = await bookingQueue.getFailed(start, end);
        break;
      case 'delayed':
        jobs = await bookingQueue.getDelayed(start, end);
        break;
      default:
        return res.status(400).json({ error: 'Invalid state' });
    }

    res.json({
      state,
      jobs: jobs.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        attemptsMade: job.attemptsMade
      }))
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error getting jobs by state:', err);
    res.status(500).json({ error: 'Failed to get jobs', message: err.message });
  }
});

app.listen(parseInt(PORT), () => {
  console.log(`🚀 Queue Service (BullMQ) running on port ${PORT}`);
  console.log(`📦 Queue: booking-queue`);
  console.log(`🔗 Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`);
});


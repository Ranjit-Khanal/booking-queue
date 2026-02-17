const express = require('express');
const cors = require('cors');
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Redis connection
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'queue-service', queue: 'booking-queue' });
});

// Add job to queue
app.post('/jobs', async (req, res) => {
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
      },
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
    console.error('Error adding job:', error);
    res.status(500).json({ error: 'Failed to add job', message: error.message });
  }
});

// Add delayed job
app.post('/jobs/delayed', async (req, res) => {
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
      },
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
    console.error('Error adding delayed job:', error);
    res.status(500).json({ error: 'Failed to add delayed job', message: error.message });
  }
});

// Get job status
app.get('/jobs/:jobId', async (req, res) => {
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

    res.json({
      jobId: job.id,
      name: job.name,
      state,
      progress,
      data: job.data,
      returnvalue,
      failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp
    });
  } catch (error) {
    console.error('Error getting job:', error);
    res.status(500).json({ error: 'Failed to get job', message: error.message });
  }
});

// Get queue statistics
app.get('/stats', async (req, res) => {
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
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats', message: error.message });
  }
});

// Get jobs by state
app.get('/jobs/state/:state', async (req, res) => {
  try {
    const { state } = req.params;
    const start = parseInt(req.query.start) || 0;
    const end = parseInt(req.query.end) || 9;

    let jobs = [];
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
    console.error('Error getting jobs by state:', error);
    res.status(500).json({ error: 'Failed to get jobs', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Queue Service (BullMQ) running on port ${PORT}`);
  console.log(`📦 Queue: booking-queue`);
  console.log(`🔗 Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`);
});


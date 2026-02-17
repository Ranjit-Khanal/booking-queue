import express from 'express';
import { getBullMQQueueData } from 'src/controllers/bullmqQueue.controller';
import { dashboard } from 'src/controllers/dashboard.controller';
import { healthCheck } from 'src/controllers/healthCheck.controller';
import { getRedisStreamsData } from 'src/controllers/redisStreams.controller';

const router = express.Router();


router.get('/services/health', healthCheck);
// Get dashboard data (all queue stats)
router.get('/dashboard', dashboard);

// Get BullMQ queue details
router.get('/queue/bullmq', getBullMQQueueData);

// Get Redis Streams details
router.get('/queue/streams', getRedisStreamsData);

export default router;
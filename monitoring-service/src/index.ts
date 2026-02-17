import express, { Request, Response } from 'express';
import cors from 'cors';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { Kafka } from 'kafkajs';
import * as dotenv from 'dotenv';
import allRoutesRouter from './routes/allroutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || '3004';

// Redis connection
export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

export const bookingQueue = new Queue('booking-queue', { connection: redis });

// Kafka admin
export const kafka = new Kafka({
  clientId: 'monitoring-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

app.use(cors());
app.use(express.json());

app.use('/', allRoutesRouter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'monitoring-service' });
});


app.listen(parseInt(PORT), () => {
  console.log(`🚀 Monitoring Service running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
});


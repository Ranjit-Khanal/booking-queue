import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { Kafka, Consumer, Producer, EachMessagePayload } from 'kafkajs';
import winston from 'winston';
import dotenv from 'dotenv';
import { BookingData } from '../../shared/types';

dotenv.config();

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const WORKER_ID = process.env.WORKER_ID || `worker-${Date.now()}`;

// Redis connection for BullMQ and Redis Streams
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

// ==================== BULLMQ WORKER ====================
const bookingQueue = new Queue('booking-queue', { connection: redisConnection });

interface BookingJobData extends BookingData {
  jobId: string;
  createdAt: string;
}

interface BookingResult {
  bookingId: string;
  status: string;
  confirmedAt: string;
  confirmationNumber: string;
  workerId: string;
}

const bullmqWorker = new Worker(
  'booking-queue',
  async (job: Job<BookingJobData, BookingResult>) => {
    logger.info(`[BullMQ] Processing job ${job.id}`, { workerId: WORKER_ID, jobId: job.id });
    
    try {
      const { bookingId, userId, hotelId, checkIn, checkOut } = job.data;
      
      // Simulate booking processing steps
      await job.updateProgress(10);
      logger.info(`[BullMQ] Job ${job.id}: Validating booking...`);
      await simulateWork(2000); // Validate booking
      
      await job.updateProgress(30);
      logger.info(`[BullMQ] Job ${job.id}: Processing payment...`);
      await simulateWork(3000); // Process payment
      
      await job.updateProgress(50);
      logger.info(`[BullMQ] Job ${job.id}: Generating confirmation PDF...`);
      await simulateWork(5000); // Generate PDF
      
      await job.updateProgress(80);
      logger.info(`[BullMQ] Job ${job.id}: Sending email notification...`);
      await simulateWork(1000); // Send email
      
      await job.updateProgress(90);
      logger.info(`[BullMQ] Job ${job.id}: Updating inventory...`);
      await simulateWork(1000); // Update inventory
      
      await job.updateProgress(100);
      
      const result: BookingResult = {
        bookingId,
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
        confirmationNumber: `CONF-${Date.now()}`,
        workerId: WORKER_ID
      };
      
      logger.info(`[BullMQ] Job ${job.id} completed successfully`, result);
      return result;
    } catch (error) {
      const err = error as Error;
      logger.error(`[BullMQ] Job ${job.id} failed:`, err);
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000
    }
  }
);

bullmqWorker.on('completed', (job: Job) => {
  logger.info(`[BullMQ] Job ${job.id} completed`);
});

bullmqWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`[BullMQ] Job ${job?.id} failed:`, err.message);
});

// ==================== REDIS STREAMS WORKER ====================
const STREAM_NAME = 'booking-stream';
const CONSUMER_GROUP = 'booking-workers';
const CONSUMER_NAME = `consumer-${WORKER_ID}`;
const DLQ_STREAM = 'booking-stream-dlq';

async function initializeStreamConsumerGroup(): Promise<void> {
  try {
    await redisConnection.xgroup('CREATE', STREAM_NAME, CONSUMER_GROUP, '0', 'MKSTREAM');
    logger.info(`[Streams] Consumer group ${CONSUMER_GROUP} created`);
  } catch (error) {
    const err = error as Error;
    if (err.message.includes('BUSYGROUP')) {
      logger.info(`[Streams] Consumer group ${CONSUMER_GROUP} already exists`);
    } else {
      logger.error(`[Streams] Error creating consumer group:`, err);
    }
  }
}

async function processStreamMessages(): Promise<void> {
  try {
    // Read messages from stream using consumer group
    const messages = await redisConnection.xreadgroup(
      'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
      'COUNT', 10,
      'BLOCK', 5000,
      'STREAMS', STREAM_NAME, '>'
    ) as Array<[string, Array<[string, string[]]>]> | null;

    if (!messages || messages.length === 0) {
      return;
    }

    const [stream, streamMessages] = messages[0];
    
    for (const [messageId, fields] of streamMessages) {
      try {
        logger.info(`[Streams] Processing message ${messageId}`, { workerId: WORKER_ID });
        
        // Parse message fields
        const messageData: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
          messageData[fields[i]] = fields[i + 1];
        }
        
        const data: BookingData = JSON.parse(messageData.data);
        const { bookingId, userId, hotelId, checkIn, checkOut } = data;
        
        // Process booking (same logic as BullMQ)
        await simulateWork(2000); // Validate
        await simulateWork(3000); // Payment
        await simulateWork(5000); // PDF
        await simulateWork(1000); // Email
        await simulateWork(1000); // Inventory
        
        // Acknowledge message
        await redisConnection.xack(STREAM_NAME, CONSUMER_GROUP, messageId);
        
        logger.info(`[Streams] Message ${messageId} processed and acknowledged`, {
          bookingId,
          workerId: WORKER_ID
        });
      } catch (error) {
        const err = error as Error;
        logger.error(`[Streams] Error processing message ${messageId}:`, err);
        
        // Check retry count (stored in message metadata)
        const retryCountField = fields.find((f, i) => fields[i - 1] === 'retryCount');
        const retryCount = parseInt(retryCountField || '0');
        
        if (retryCount < 3) {
          // Retry: don't ACK, let it go back to PEL
          logger.info(`[Streams] Message ${messageId} will be retried (attempt ${retryCount + 1})`);
        } else {
          // Max retries reached, move to DLQ
          const dataField = fields.find((f, i) => fields[i - 1] === 'data');
          await redisConnection.xadd(
            DLQ_STREAM,
            '*',
            'originalMessageId', messageId,
            'originalStream', STREAM_NAME,
            'error', err.message,
            'failedAt', new Date().toISOString(),
            'data', dataField || ''
          );
          
          await redisConnection.xack(STREAM_NAME, CONSUMER_GROUP, messageId);
          logger.error(`[Streams] Message ${messageId} moved to DLQ after ${retryCount} retries`);
        }
      }
    }
  } catch (error) {
    const err = error as Error;
    if (!err.message.includes('timeout')) {
      logger.error(`[Streams] Error reading messages:`, err);
    }
  }
}

// Process pending messages (from PEL)
async function processPendingMessages(): Promise<void> {
  try {
    const pending = await redisConnection.xpending(STREAM_NAME, CONSUMER_GROUP, '-', '+', 10) as Array<[string, string, string, string]> | null;
    
    if (!pending || pending.length === 0) {
      return;
    }

    for (const [messageId, consumer, idleTime, deliveryCount] of pending) {
      if (parseInt(idleTime) > 60000 && consumer === CONSUMER_NAME) {
        // Claim and process
        const claimed = await redisConnection.xclaim(
          STREAM_NAME,
          CONSUMER_GROUP,
          CONSUMER_NAME,
          60000,
          messageId
        ) as Array<[string, string[]]> | null;
        
        if (claimed && claimed.length > 0) {
          logger.info(`[Streams] Claimed pending message ${messageId}`);
          // Process it
          await processStreamMessages();
        }
      }
    }
  } catch (error) {
    const err = error as Error;
    logger.error(`[Streams] Error processing pending messages:`, err);
  }
}

// Start Redis Streams consumer
async function startStreamsWorker(): Promise<void> {
  await initializeStreamConsumerGroup();
  
  // Process messages in a loop
  setInterval(async () => {
    await processStreamMessages();
    await processPendingMessages();
  }, 2000);
  
  logger.info(`[Streams] Worker started for consumer group ${CONSUMER_GROUP}`);
}

// ==================== KAFKA WORKER ====================
const kafka = new Kafka({
  clientId: `booking-worker-${WORKER_ID}`,
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

const consumer: Consumer = kafka.consumer({ groupId: 'booking-workers' });
const TOPIC = 'booking-events';
const DLQ_TOPIC = 'booking-events-dlq';

async function startKafkaWorker(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });
  
  const producer: Producer = kafka.producer();
  await producer.connect();
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
      try {
        const messageData: BookingData & { messageId: string } = JSON.parse(message.value?.toString() || '{}');
        const { bookingId, userId, hotelId, checkIn, checkOut, messageId } = messageData;
        
        logger.info(`[Kafka] Processing message from partition ${partition}`, {
          messageId,
          bookingId,
          workerId: WORKER_ID,
          partition,
          offset: message.offset
        });
        
        // Process booking
        await simulateWork(2000); // Validate
        await simulateWork(3000); // Payment
        await simulateWork(5000); // PDF
        await simulateWork(1000); // Email
        await simulateWork(1000); // Inventory
        
        logger.info(`[Kafka] Message processed successfully`, {
          messageId,
          bookingId,
          workerId: WORKER_ID
        });
      } catch (error) {
        const err = error as Error;
        logger.error(`[Kafka] Error processing message:`, err);
        
        // Send to DLQ
        try {
          await producer.send({
            topic: DLQ_TOPIC,
            messages: [{
              key: message.key?.toString() || '',
              value: message.value?.toString() || '',
              headers: {
                'original-topic': topic,
                'original-partition': partition.toString(),
                'original-offset': message.offset,
                'error': err.message,
                'failed-at': new Date().toISOString()
              }
            }]
          });
          
          logger.error(`[Kafka] Message sent to DLQ`, {
            messageId: message.key?.toString(),
            error: err.message
          });
        } catch (dlqError) {
          const dlqErr = dlqError as Error;
          logger.error(`[Kafka] Failed to send to DLQ:`, dlqErr);
        }
      }
    }
  });
  
  logger.info(`[Kafka] Consumer started for topic ${TOPIC}`);
}

// ==================== HELPER FUNCTIONS ====================
function simulateWork(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== STARTUP ====================
async function start(): Promise<void> {
  logger.info(`🚀 Worker Service starting...`, { workerId: WORKER_ID });
  
  // Start all workers
  await startStreamsWorker();
  await startKafkaWorker();
  
  logger.info(`✅ All workers started`, { workerId: WORKER_ID });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down workers...');
  await bullmqWorker.close();
  await consumer.disconnect();
  await redisConnection.quit();
  process.exit(0);
});

start().catch((error: Error) => {
  logger.error('Failed to start workers:', error);
  process.exit(1);
});


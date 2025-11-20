const { Worker, Queue } = require('bullmq');
const Redis = require('ioredis');
const { Kafka } = require('kafkajs');
const winston = require('winston');
require('dotenv').config();

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
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

// ==================== BULLMQ WORKER ====================
const bookingQueue = new Queue('booking-queue', { connection: redisConnection });

const bullmqWorker = new Worker(
  'booking-queue',
  async (job) => {
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
      
      const result = {
        bookingId,
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
        confirmationNumber: `CONF-${Date.now()}`,
        workerId: WORKER_ID
      };
      
      logger.info(`[BullMQ] Job ${job.id} completed successfully`, result);
      return result;
    } catch (error) {
      logger.error(`[BullMQ] Job ${job.id} failed:`, error);
      throw error;
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

bullmqWorker.on('completed', (job) => {
  logger.info(`[BullMQ] Job ${job.id} completed`);
});

bullmqWorker.on('failed', (job, err) => {
  logger.error(`[BullMQ] Job ${job.id} failed:`, err.message);
});

// ==================== REDIS STREAMS WORKER ====================
const STREAM_NAME = 'booking-stream';
const CONSUMER_GROUP = 'booking-workers';
const CONSUMER_NAME = `consumer-${WORKER_ID}`;
const DLQ_STREAM = 'booking-stream-dlq';

async function initializeStreamConsumerGroup() {
  try {
    await redisConnection.xgroup('CREATE', STREAM_NAME, CONSUMER_GROUP, '0', 'MKSTREAM');
    logger.info(`[Streams] Consumer group ${CONSUMER_GROUP} created`);
  } catch (error) {
    if (error.message.includes('BUSYGROUP')) {
      logger.info(`[Streams] Consumer group ${CONSUMER_GROUP} already exists`);
    } else {
      logger.error(`[Streams] Error creating consumer group:`, error);
    }
  }
}

async function processStreamMessages() {
  try {
    // Read messages from stream using consumer group
    const messages = await redisConnection.xreadgroup(
      'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
      'COUNT', 10,
      'BLOCK', 5000,
      'STREAMS', STREAM_NAME, '>'
    );

    if (!messages || messages.length === 0) {
      return;
    }

    const [stream, streamMessages] = messages[0];
    
    for (const [messageId, fields] of streamMessages) {
      try {
        logger.info(`[Streams] Processing message ${messageId}`, { workerId: WORKER_ID });
        
        // Parse message fields
        const messageData = {};
        for (let i = 0; i < fields.length; i += 2) {
          messageData[fields[i]] = fields[i + 1];
        }
        
        const data = JSON.parse(messageData.data);
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
        logger.error(`[Streams] Error processing message ${messageId}:`, error);
        
        // Check retry count (stored in message metadata)
        const retryCount = parseInt(fields.find((f, i) => fields[i - 1] === 'retryCount') || '0');
        
        if (retryCount < 3) {
          // Retry: don't ACK, let it go back to PEL
          logger.info(`[Streams] Message ${messageId} will be retried (attempt ${retryCount + 1})`);
        } else {
          // Max retries reached, move to DLQ
          await redisConnection.xadd(
            DLQ_STREAM,
            '*',
            'originalMessageId', messageId,
            'originalStream', STREAM_NAME,
            'error', error.message,
            'failedAt', new Date().toISOString(),
            'data', fields.find((f, i) => fields[i - 1] === 'data')
          );
          
          await redisConnection.xack(STREAM_NAME, CONSUMER_GROUP, messageId);
          logger.error(`[Streams] Message ${messageId} moved to DLQ after ${retryCount} retries`);
        }
      }
    }
  } catch (error) {
    if (!error.message.includes('timeout')) {
      logger.error(`[Streams] Error reading messages:`, error);
    }
  }
}

// Process pending messages (from PEL)
async function processPendingMessages() {
  try {
    const pending = await redisConnection.xpending(STREAM_NAME, CONSUMER_GROUP, '-', '+', 10);
    
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
        );
        
        if (claimed && claimed.length > 0) {
          logger.info(`[Streams] Claimed pending message ${messageId}`);
          // Process it
          await processStreamMessages();
        }
      }
    }
  } catch (error) {
    logger.error(`[Streams] Error processing pending messages:`, error);
  }
}

// Start Redis Streams consumer
async function startStreamsWorker() {
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

const consumer = kafka.consumer({ groupId: 'booking-workers' });
const TOPIC = 'booking-events';
const DLQ_TOPIC = 'booking-events-dlq';

async function startKafkaWorker() {
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });
  
  const producer = kafka.producer();
  await producer.connect();
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const messageData = JSON.parse(message.value.toString());
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
        logger.error(`[Kafka] Error processing message:`, error);
        
        // Send to DLQ
        try {
          await producer.send({
            topic: DLQ_TOPIC,
            messages: [{
              key: message.key.toString(),
              value: message.value.toString(),
              headers: {
                'original-topic': topic,
                'original-partition': partition.toString(),
                'original-offset': message.offset,
                'error': error.message,
                'failed-at': new Date().toISOString()
              }
            }]
          });
          
          logger.error(`[Kafka] Message sent to DLQ`, {
            messageId: message.key.toString(),
            error: error.message
          });
        } catch (dlqError) {
          logger.error(`[Kafka] Failed to send to DLQ:`, dlqError);
        }
      }
    }
  });
  
  logger.info(`[Kafka] Consumer started for topic ${TOPIC}`);
}

// ==================== HELPER FUNCTIONS ====================
function simulateWork(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== STARTUP ====================
async function start() {
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

start().catch(error => {
  logger.error('Failed to start workers:', error);
  process.exit(1);
});


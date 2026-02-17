# Distributed Booking Queue System

A comprehensive learning project demonstrating distributed systems concepts using **BullMQ**, **Redis Streams**, and **Kafka** with Node.js microservices architecture.

**Built with TypeScript** - All services are written in TypeScript for type safety and better developer experience.

## 📚 Learning Objectives

This project teaches:
- How distributed queues work
- Differences between Redis Queue, Redis Streams, and Kafka
- Building microservices with message passing
- Consumer groups and load distribution
- Job retries, dead letter queues, and backpressure
- Horizontal scaling of worker instances
- Real-world backend task processing patterns

## 🏗️ Architecture

The system consists of 6 microservices and 1 frontend:

1. **api-service** - HTTP REST API for booking requests
2. **queue-service** - BullMQ queue management
3. **stream-service** - Redis Streams operations
4. **kafka-service** - Kafka producer/consumer management
5. **worker-service** - Job processors for all queue types
6. **monitoring-service** - Dashboard and metrics API
7. **frontend** - React + TypeScript web interface

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- TypeScript 5.3+ (for local development)
- Basic understanding of microservices

### 1. Clone and Navigate

```bash
cd distributed-system/booking-queue
```

### 2. Start Infrastructure

```bash
docker-compose up -d redis zookeeper kafka
```

Wait for services to be healthy (about 30 seconds).

### 3. Start All Services

```bash
docker-compose up --build
```

This will start:
- Redis (port 6379)
- Zookeeper (port 2181)
- Kafka (ports 9092, 9093)
- API Service (port 3000)
- Queue Service (port 3001)
- Stream Service (port 3002)
- Kafka Service (port 3003)
- Worker Service (2 instances)
- Monitoring Service (port 3004)
- Frontend (port 5173)

### 4. Access the Frontend

Open your browser and navigate to:
```
http://localhost:5173
```

The frontend provides:
- 📊 **Dashboard** - Real-time monitoring of all queues
- ➕ **Create Booking** - Create bookings via web form
- 🔍 **Check Status** - View booking status across all queues

### 5. Test the System

#### Via Frontend (Recommended)
Use the web interface at `http://localhost:5173` to create bookings and monitor the system.

#### Via API (Alternative)

#### Create a Booking (publishes to all 3 queues)

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "hotelId": "hotel-456",
    "checkIn": "2024-01-15",
    "checkOut": "2024-01-20",
    "guests": 2,
    "roomType": "deluxe"
  }'
```

Response:
```json
{
  "bookingId": "abc-123-def",
  "queues": {
    "bullmq": { "jobId": "...", "status": "queued" },
    "redisStreams": { "messageId": "...", "status": "queued" },
    "kafka": { "messageId": "...", "status": "queued" }
  }
}
```

#### Check Booking Status

```bash
curl http://localhost:3000/api/bookings/{bookingId}/status
```

#### Create Delayed Booking (BullMQ only)

```bash
curl -X POST http://localhost:3000/api/bookings/delayed \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "hotelId": "hotel-456",
    "checkIn": "2024-01-15",
    "checkOut": "2024-01-20",
    "delaySeconds": 10
  }'
```

#### View Dashboard

```bash
curl http://localhost:3004/dashboard
```

Or open in browser: `http://localhost:3004/dashboard`

## 📊 Monitoring Endpoints

### Monitoring Service

- `GET /health` - Health check
- `GET /dashboard` - Complete dashboard with all queue stats
- `GET /queue/bullmq` - BullMQ queue details
- `GET /queue/streams` - Redis Streams details
- `GET /services/health` - All service health status

### Queue Service (BullMQ)

- `GET /health` - Health check
- `POST /jobs` - Add job to queue
- `POST /jobs/delayed` - Add delayed job
- `GET /jobs/:jobId` - Get job status
- `GET /stats` - Queue statistics
- `GET /jobs/state/:state` - Get jobs by state (waiting/active/completed/failed/delayed)

### Stream Service (Redis Streams)

- `GET /health` - Health check
- `POST /messages` - Add message to stream
- `GET /messages/:messageId` - Get message status
- `GET /stats` - Stream statistics
- `GET /messages` - Read recent messages

### Kafka Service

- `GET /health` - Health check
- `POST /messages` - Send message to Kafka topic
- `GET /messages/:messageId` - Get message metadata
- `GET /stats` - Topic statistics

## 🔄 How Each Queue Works

### 1. BullMQ (Redis-based Queue)

**How it works:**
- Jobs stored in Redis with structured data
- Workers poll Redis for available jobs
- Automatic retry with exponential backoff
- Built-in progress tracking
- Dead letter queue for failed jobs

**Example:**
```javascript
// Producer
const job = await queue.add('booking', data, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
});

// Worker
const worker = new Worker('booking-queue', async (job) => {
  await job.updateProgress(50);
  // Process job...
  return result;
});
```

**Key Features:**
- ✅ Automatic retries
- ✅ Progress tracking
- ✅ Delayed jobs
- ✅ Job priorities
- ✅ Rate limiting

### 2. Redis Streams (Consumer Groups)

**How it works:**
- Messages appended to stream using `XADD`
- Consumer groups read messages with `XREADGROUP`
- Messages must be ACK'd after processing
- Un-ACK'd messages go to Pending Entry List (PEL)
- Each consumer group maintains its own offset

**Example:**
```javascript
// Producer
await redis.xadd('booking-stream', '*', 'data', JSON.stringify(data));

// Consumer
const messages = await redis.xreadgroup(
  'GROUP', 'workers', 'consumer-1',
  'COUNT', 10,
  'BLOCK', 5000,
  'STREAMS', 'booking-stream', '>'
);

// After processing
await redis.xack('booking-stream', 'workers', messageId);
```

**Key Features:**
- ✅ Consumer groups for load distribution
- ✅ Message ordering
- ✅ Pending Entry List for retries
- ✅ Multiple consumer groups per stream

### 3. Kafka (Distributed Event Log)

**How it works:**
- Topics divided into partitions
- Producers write to partitions
- Consumers in groups read from partitions
- Each partition maintains offset per consumer group
- Messages persisted to disk, replicated

**Example:**
```javascript
// Producer
await producer.send({
  topic: 'booking-events',
  messages: [{ key: id, value: JSON.stringify(data) }]
});

// Consumer
await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    // Process message
    // Offset automatically committed
  }
});
```

**Key Features:**
- ✅ High throughput
- ✅ Durability (disk persistence)
- ✅ Partition-level ordering
- ✅ Message replay
- ✅ Consumer groups

## 📈 Scaling Workers

### Horizontal Scaling

All three queue systems support horizontal scaling:

#### BullMQ
```bash
# Scale workers in docker-compose.yml
worker-service:
  deploy:
    replicas: 5  # Run 5 worker instances
```

Multiple workers automatically share the same queue. Jobs are distributed round-robin.

#### Redis Streams
```bash
# Each worker is a consumer in the same group
# Messages are distributed across consumers
```

Multiple consumers in the same group automatically share messages.

#### Kafka
```bash
# Multiple consumers in same consumer group
# Partitions distributed across consumers
```

If you have 3 partitions and 3 consumers, each consumer gets 1 partition.

### Load Distribution

- **BullMQ**: Round-robin job distribution
- **Redis Streams**: Messages distributed across consumers in group
- **Kafka**: Partitions distributed across consumers (1 partition = 1 consumer max)

## 🔁 Retry & Backoff Strategies

### BullMQ
- Built-in exponential backoff
- Configurable attempts and delays
- Automatic retry on failure

```javascript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000  // 2s, 4s, 8s
  }
}
```

### Redis Streams
- Manual retry via Pending Entry List (PEL)
- Messages not ACK'd go to PEL
- Workers can claim and retry from PEL

```javascript
// Check PEL
const pending = await redis.xpending('stream', 'group');

// Claim and retry
await redis.xclaim('stream', 'group', 'consumer', 60000, messageId);
```

### Kafka
- Consumer offset management
- Failed messages can be sent to DLQ topic
- Manual retry by replaying from offset

## 💀 Dead Letter Queue (DLQ)

### BullMQ
- Automatic DLQ support
- Failed jobs after max retries moved to DLQ

### Redis Streams
- Separate stream for failed messages
- Messages moved to DLQ stream after max retries

### Kafka
- Separate topic for failed messages
- Producer sends failed messages to DLQ topic

## 🧪 Testing Each Queue

### Test BullMQ

```bash
# Create job
curl -X POST http://localhost:3001/jobs \
  -H "Content-Type: application/json" \
  -d '{"type": "booking", "data": {"test": true}}'

# Check status
curl http://localhost:3001/jobs/{jobId}

# View stats
curl http://localhost:3001/stats
```

### Test Redis Streams

```bash
# Add message
curl -X POST http://localhost:3002/messages \
  -H "Content-Type: application/json" \
  -d '{"type": "booking", "data": {"test": true}}'

# Read messages
curl http://localhost:3002/messages

# View stats
curl http://localhost:3002/stats
```

### Test Kafka

```bash
# Send message
curl -X POST http://localhost:3003/messages \
  -H "Content-Type: application/json" \
  -d '{"type": "booking", "data": {"test": true}}'

# View stats
curl http://localhost:3003/stats
```

## 📁 Project Structure

```
booking-queue/
├── api-service/          # HTTP API for booking requests
│   ├── src/
│   │   └── index.js
│   ├── package.json
│   └── Dockerfile
├── queue-service/        # BullMQ queue management
│   ├── src/
│   │   └── index.js
│   ├── package.json
│   └── Dockerfile
├── stream-service/       # Redis Streams operations
│   ├── src/
│   │   └── index.js
│   ├── package.json
│   └── Dockerfile
├── kafka-service/        # Kafka producer/consumer
│   ├── src/
│   │   └── index.js
│   ├── package.json
│   └── Dockerfile
├── worker-service/       # Job processors
│   ├── src/
│   │   └── index.js
│   ├── package.json
│   └── Dockerfile
├── monitoring-service/   # Dashboard and metrics
│   ├── src/
│   │   └── index.js
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml    # All services configuration
├── ARCHITECTURE.md       # Detailed architecture docs
└── README.md            # This file
```

## 🔍 Understanding the Differences

### When to Use BullMQ
- Task queues with job processing
- Need built-in retries and backoff
- Progress tracking required
- Delayed/scheduled jobs
- Rate limiting needed

### When to Use Redis Streams
- Event streaming
- Simple message passing
- Need consumer groups
- Lightweight solution
- Already using Redis

### When to Use Kafka
- High throughput requirements
- Need message durability
- Event sourcing
- Log aggregation
- Multiple consumer groups
- Need message replay

## 🐛 Troubleshooting

### Services not starting
```bash
# Check logs
docker-compose logs [service-name]

# Restart specific service
docker-compose restart [service-name]
```

### Redis connection issues
```bash
# Test Redis connection
docker exec -it booking-redis redis-cli ping
```

### Kafka not ready
```bash
# Wait for Kafka to be healthy
docker-compose ps kafka

# Check Kafka logs
docker-compose logs kafka
```

### Workers not processing
- Check worker logs: `docker-compose logs worker-service`
- Verify Redis/Kafka connections
- Check queue/message counts in monitoring dashboard

## 📝 Development

### Run services locally (without Docker)

```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start Kafka (requires separate setup)

# Terminal 3: Start services (TypeScript)
cd api-service && npm install && npm run dev
cd queue-service && npm install && npm run dev
# ... etc

# Or build and run
cd api-service && npm install && npm run build && npm start
```

### Environment Variables

Each service uses environment variables (see `.env` files or docker-compose.yml):
- `REDIS_HOST` - Redis hostname
- `REDIS_PORT` - Redis port
- `KAFKA_BROKER` - Kafka broker address
- `WORKER_ID` - Unique worker identifier

## 🎓 Key Concepts Learned

1. **Message Passing**: Services communicate via queues, not direct calls
2. **Consumer Groups**: Multiple workers share load
3. **Retry Strategies**: Exponential backoff, PEL, offset management
4. **Dead Letter Queues**: Handle permanently failed jobs
5. **Horizontal Scaling**: Add more workers to increase throughput
6. **Progress Tracking**: Monitor job execution progress
7. **Ordering**: Partition-level ordering in Kafka, stream ordering in Redis Streams

## 📚 Additional Resources

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Streams Guide](https://redis.io/docs/data-types/streams/)
- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [Microservices Patterns](https://microservices.io/patterns/)

## 🤝 Contributing

This is a learning project. Feel free to:
- Add more job types
- Implement additional features
- Improve error handling
- Add more monitoring capabilities

## 📄 License

This project is for educational purposes.

---

**Happy Learning! 🚀**


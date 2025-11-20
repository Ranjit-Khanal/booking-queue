# Distributed Booking Queue System - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         API SERVICE                              │
│  (Express.js - HTTP endpoints for booking requests)             │
└──────┬──────────────────┬──────────────────┬────────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ BULLMQ      │  │ REDIS       │  │ KAFKA       │
│ SERVICE     │  │ STREAMS     │  │ SERVICE     │
│             │  │ SERVICE     │  │             │
│ (Producer)  │  │ (Producer)  │  │ (Producer)  │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                 │
       ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    QUEUE INFRASTRUCTURE                       │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Redis   │  │ Redis Streams │  │  Kafka + Zookeeper   │  │
│  │ (BullMQ) │  │  (XADD/XREAD) │  │  (Topics/Partitions) │  │
│  └────┬─────┘  └──────┬────────┘  └──────────┬───────────┘  │
└───────┼───────────────┼──────────────────────┼──────────────┘
        │               │                      │
        ▼               ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    WORKER SERVICE                            │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ BullMQ   │  │ Streams      │  │ Kafka                │  │
│  │ Workers  │  │ Consumers    │  │ Consumers            │  │
│  │ (Scales) │  │ (Groups)     │  │ (Groups)              │  │
│  └────┬─────┘  └──────┬───────┘  └──────────┬───────────┘  │
└───────┼───────────────┼──────────────────────┼──────────────┘
        │               │                      │
        ▼               ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│              MONITORING SERVICE                              │
│  (BullMQ UI / Custom Dashboard / Metrics)                   │
└─────────────────────────────────────────────────────────────┘
```

## Queue Technology Comparison

### 1. BullMQ (Redis-based Queue)
**Characteristics:**
- Built on Redis with structured job data
- Automatic retries with exponential backoff
- Job priorities and delayed execution
- Built-in rate limiting
- Progress tracking
- Dead letter queues
- **Best for:** Task queues, job processing, scheduled tasks

**How it works:**
- Jobs stored as Redis lists/keys
- Workers poll Redis for jobs
- Redis provides atomic operations for job locking
- Single Redis instance can handle multiple queues

### 2. Redis Streams (Consumer Groups)
**Characteristics:**
- Append-only log structure
- Consumer groups for load distribution
- Message acknowledgment (ACK)
- Pending entry list (PEL) for retries
- Message IDs for ordering
- **Best for:** Event streaming, log processing, real-time feeds

**How it works:**
- Producers use `XADD` to append messages
- Consumers use `XREADGROUP` to read from groups
- Messages are ACK'd after processing
- Un-ACK'd messages go to PEL for retry
- Each consumer group maintains its own offset

### 3. Kafka (Distributed Event Log)
**Characteristics:**
- Distributed, partitioned, replicated logs
- High throughput and durability
- Consumer groups for parallel processing
- Message retention and replay
- Partition-level ordering
- **Best for:** Event sourcing, log aggregation, high-volume streams

**How it works:**
- Topics divided into partitions
- Producers write to partitions
- Consumers in groups read from partitions
- Each partition maintains offset per consumer group
- Messages persisted to disk, replicated across brokers

## Message Flow: Booking Processing Example

### Scenario: User books a hotel room

1. **API Service** receives POST `/api/bookings`
2. **Producer** (BullMQ/Streams/Kafka) creates job with:
   - Booking ID
   - User ID
   - Room details
   - Timestamp
3. **Queue** stores job (different mechanisms per tech)
4. **Worker** picks up job and processes:
   - Validate booking
   - Process payment
   - Generate confirmation PDF
   - Send email notification
   - Update inventory
5. **Progress updates** sent back to queue
6. **Completion** or **failure** handled:
   - Success: Job completed
   - Failure: Retry with backoff
   - Max retries: Move to Dead Letter Queue

## Service Responsibilities

### api-service
- HTTP REST API
- Receives booking requests
- Validates input
- Publishes jobs to all three queue types
- Returns job IDs to clients

### queue-service (BullMQ)
- BullMQ queue management
- Job creation with options (delay, priority, retry)
- Queue monitoring

### stream-service (Redis Streams)
- Redis Stream operations
- XADD for publishing
- Consumer group management
- Stream monitoring

### kafka-service
- Kafka producer/consumer setup
- Topic management
- Partition handling
- Offset management

### worker-service
- Job processors for all three queue types
- Business logic (booking processing)
- Error handling and retries
- Progress reporting

### monitoring-service
- BullMQ UI integration
- Custom metrics dashboard
- Queue health monitoring
- Job statistics

## Scaling Strategy

### Horizontal Scaling
- **Workers**: Run multiple worker instances
  - BullMQ: Multiple workers process same queue
  - Redis Streams: Multiple consumers in same group
  - Kafka: Multiple consumers in same consumer group

### Load Distribution
- **BullMQ**: Round-robin job distribution
- **Redis Streams**: Messages distributed across consumers in group
- **Kafka**: Partitions distributed across consumers

### Retry & Backoff
- **BullMQ**: Built-in exponential backoff
- **Redis Streams**: Manual retry via PEL
- **Kafka**: Consumer offset management for retries

## Dead Letter Queue (DLQ)

Jobs that fail after max retries are moved to DLQ:
- **BullMQ**: Automatic DLQ support
- **Redis Streams**: Separate stream for failed jobs
- **Kafka**: Separate topic for failed messages

## Data Flow Example: Booking Job

```
1. Client → POST /api/bookings
   {
     "userId": "123",
     "hotelId": "456",
     "checkIn": "2024-01-15",
     "checkOut": "2024-01-20"
   }

2. API Service → Creates job:
   {
     "jobId": "job-abc-123",
     "type": "booking",
     "data": { ... },
     "timestamp": "2024-01-01T10:00:00Z"
   }

3. Producer → Publishes to queue (BullMQ/Streams/Kafka)

4. Worker → Processes:
   - Validate booking (2s)
   - Process payment (3s)
   - Generate PDF (5s)
   - Send email (1s)
   - Update inventory (1s)
   
   Total: ~12 seconds

5. Progress updates:
   - 0% → Job started
   - 20% → Payment processed
   - 50% → PDF generated
   - 80% → Email sent
   - 100% → Completed

6. Result → Success or Failure
   - Success: Booking confirmed
   - Failure: Retry or DLQ
```

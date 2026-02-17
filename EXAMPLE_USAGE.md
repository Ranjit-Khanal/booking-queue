# Example Usage of @shared Package

This document shows how to use the shared types package in microservices.

## Basic Import

```typescript
import { BookingType, EventType, BookingStatus } from '@shared/index';
```

## Complete Example: API Service

```typescript
import express, { Request, Response } from 'express';
import { 
  BookingData, 
  BookingResponse, 
  QueueResponse,
  EventType,
  BookingStatus,
  RoomType 
} from '@shared/index';

const app = express();

// Using BookingData type
app.post('/api/bookings', async (req: Request<{}, BookingResponse, BookingData>, res: Response) => {
  const booking: BookingData = {
    bookingId: 'abc-123',
    userId: req.body.userId,
    hotelId: req.body.hotelId,
    checkIn: req.body.checkIn,
    checkOut: req.body.checkOut,
    guests: req.body.guests || 1,
    roomType: req.body.roomType || RoomType.STANDARD,
    createdAt: new Date().toISOString()
  };

  // Use EventType enum
  console.log(`Event: ${EventType.BOOKING_CREATED}`);

  // Create response
  const response: BookingResponse = {
    bookingId: booking.bookingId,
    queues: {
      bullmq: { jobId: 'job-1', status: 'queued' },
      redisStreams: { messageId: 'msg-1', status: 'queued' },
      kafka: { messageId: 'msg-2', status: 'queued' }
    }
  };

  return res.status(201).json(response);
});
```

## Example: Queue Service

```typescript
import { Queue } from 'bullmq';
import { 
  BookingData, 
  QueueJobOptions, 
  JobStatus,
  EventType 
} from '@shared/index';

const queue = new Queue('booking-queue');

// Add job with typed options
async function addBookingJob(booking: BookingData) {
  const options: QueueJobOptions = {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: true
  };

  const job = await queue.add(EventType.BOOKING_CREATED, booking, options);
  return job;
}

// Get job status with typed response
async function getJobStatus(jobId: string): Promise<JobStatus> {
  const job = await queue.getJob(jobId);
  if (!job) {
    throw new Error('Job not found');
  }

  const status: JobStatus = {
    jobId: job.id!,
    name: job.name,
    state: await job.getState(),
    progress: job.progress as number,
    data: job.data,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp
  };

  return status;
}
```

## Example: Worker Service

```typescript
import { Worker } from 'bullmq';
import { 
  BookingData, 
  BookingType,
  EventType,
  BookingStatus 
} from '@shared/index';

const worker = new Worker(
  'booking-queue',
  async (job) => {
    const booking: BookingType = job.data;

    // Process booking
    console.log(`Processing booking ${booking.bookingId}`);
    console.log(`Event type: ${EventType.BOOKING_CREATED}`);

    // Update progress
    await job.updateProgress(50);

    // Return result
    return {
      bookingId: booking.bookingId,
      status: BookingStatus.CONFIRMED,
      confirmedAt: new Date().toISOString()
    };
  }
);
```

## Example: Using Enums

```typescript
import { EventType, BookingStatus, RoomType, QueueType } from '@shared/index';

// Event types
const event = EventType.BOOKING_CREATED;
console.log(event); // 'booking.created'

// Booking status
const status = BookingStatus.CONFIRMED;
console.log(status); // 'confirmed'

// Room types
const room = RoomType.DELUXE;
console.log(room); // 'deluxe'

// Queue types
const queue = QueueType.BULLMQ;
console.log(queue); // 'bullmq'
```

## Example: Event Handling

```typescript
import { BookingEvent, QueueEvent, EventType, QueueType } from '@shared/index';

// Create booking event
const bookingEvent: BookingEvent = {
  type: EventType.BOOKING_CREATED,
  bookingId: 'abc-123',
  userId: 'user-456',
  timestamp: new Date().toISOString(),
  data: {
    hotelId: 'hotel-789',
    checkIn: '2024-01-15',
    checkOut: '2024-01-20'
  }
};

// Create queue event
const queueEvent: QueueEvent = {
  queueType: QueueType.BULLMQ,
  event: bookingEvent,
  metadata: {
    jobId: 'job-123',
    partition: 0,
    offset: '100'
  }
};
```

## Type Safety Benefits

All types are shared across services, ensuring:

1. **Consistency** - Same types used everywhere
2. **Type Safety** - Compile-time checking
3. **IntelliSense** - Auto-completion in IDEs
4. **Refactoring** - Safe refactoring across services
5. **Documentation** - Types serve as documentation

## Building the Shared Package

Before using in services, build the shared package:

```bash
cd shared
npm install
npm run build
```

This generates:
- `dist/index.js` - Compiled JavaScript
- `dist/index.d.ts` - TypeScript declarations

## Path Alias Configuration

The `@shared/*` path alias is configured in:
- Root `tsconfig.base.json`
- Each service's `tsconfig.json`

This allows imports like:
```typescript
import { BookingType } from '@shared/index';
```

Instead of:
```typescript
import { BookingType } from '../../shared/src/index';
```


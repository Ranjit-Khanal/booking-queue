# @booking-queue/shared

Shared TypeScript types and utilities for the booking queue system.

## Structure

```
shared/
├── src/
│   └── index.ts      # All exports
├── dist/             # Compiled output (generated)
├── package.json      # Package configuration
└── tsconfig.json     # TypeScript configuration
```

## Building

```bash
cd shared
npm install
npm run build
```

This will compile TypeScript to JavaScript in the `dist/` directory.

## Usage in Services

Import types using the `@shared` path alias:

```typescript
import { 
  BookingData, 
  BookingType, 
  EventType, 
  BookingStatus,
  QueueJobOptions 
} from '@shared/index';
```

## Available Exports

### Types
- `BookingData` - Booking information structure
- `BookingType` - Alias for BookingData
- `BookingRequest` - Booking creation request
- `User` - User information
- `Hotel` - Hotel information

### Enums
- `EventType` - Event type enumeration
- `BookingStatus` - Booking status enumeration
- `RoomType` - Room type enumeration
- `QueueType` - Queue type enumeration

### Queue Types
- `QueueJobOptions` - BullMQ job options
- `QueueResponse` - Queue operation response
- `JobStatus` - Job status information
- `QueueStats` - Queue statistics

### Stream Types
- `StreamMessage` - Redis Streams message

### Kafka Types
- `KafkaMessageMetadata` - Kafka message metadata

### Monitoring Types
- `DashboardData` - Dashboard data structure
- `HealthStatus` - Service health status
- `ServiceHealth` - Service health information

### Event Types
- `BookingEvent` - Booking event structure
- `QueueEvent` - Queue event structure

## Example Usage

```typescript
import { BookingType, EventType, BookingStatus } from '@shared/index';

// Use types
const booking: BookingType = {
  bookingId: '123',
  userId: 'user-456',
  hotelId: 'hotel-789',
  checkIn: '2024-01-15',
  checkOut: '2024-01-20',
  guests: 2,
  roomType: 'deluxe',
  createdAt: new Date().toISOString()
};

// Use enums
const eventType = EventType.BOOKING_CREATED;
const status = BookingStatus.CONFIRMED;
```


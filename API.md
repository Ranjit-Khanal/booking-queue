# API Documentation

## API Service Endpoints

Base URL: `http://localhost:3000`

### Create Booking
**POST** `/api/bookings`

Creates a booking and publishes to all three queue systems (BullMQ, Redis Streams, Kafka).

**Request Body:**
```json
{
  "userId": "user-123",
  "hotelId": "hotel-456",
  "checkIn": "2024-01-15",
  "checkOut": "2024-01-20",
  "guests": 2,
  "roomType": "deluxe"
}
```

**Response:**
```json
{
  "bookingId": "abc-123-def-456",
  "queues": {
    "bullmq": {
      "jobId": "job-123",
      "status": "queued"
    },
    "redisStreams": {
      "messageId": "msg-456",
      "status": "queued"
    },
    "kafka": {
      "messageId": "msg-789",
      "status": "queued"
    }
  }
}
```

### Get Booking Status
**GET** `/api/bookings/:bookingId/status`

Returns the status of a booking from all queue systems.

**Response:**
```json
{
  "bookingId": "abc-123-def-456",
  "status": {
    "bullmq": {
      "jobId": "job-123",
      "state": "completed",
      "progress": 100,
      "returnvalue": { ... }
    },
    "redisStreams": { ... },
    "kafka": { ... }
  }
}
```

### Create Delayed Booking
**POST** `/api/bookings/delayed`

Creates a booking that will be processed after a delay (BullMQ only).

**Request Body:**
```json
{
  "userId": "user-123",
  "hotelId": "hotel-456",
  "checkIn": "2024-01-15",
  "checkOut": "2024-01-20",
  "delaySeconds": 10
}
```

**Response:**
```json
{
  "bookingId": "abc-123",
  "delaySeconds": 10,
  "jobId": "job-123",
  "scheduledFor": "2024-01-01T10:00:10Z",
  "message": "Booking will be processed in 10 seconds"
}
```

## Queue Service (BullMQ) Endpoints

Base URL: `http://localhost:3001`

### Add Job
**POST** `/jobs`

**Request Body:**
```json
{
  "type": "booking",
  "data": {
    "bookingId": "abc-123",
    "userId": "user-123",
    "hotelId": "hotel-456"
  },
  "options": {
    "attempts": 3,
    "backoff": {
      "type": "exponential",
      "delay": 2000
    }
  }
}
```

### Add Delayed Job
**POST** `/jobs/delayed`

**Request Body:**
```json
{
  "type": "booking",
  "data": { ... },
  "delay": 10000
}
```

### Get Job Status
**GET** `/jobs/:jobId`

### Get Queue Statistics
**GET** `/stats`

### Get Jobs by State
**GET** `/jobs/state/:state`

States: `waiting`, `active`, `completed`, `failed`, `delayed`

## Stream Service (Redis Streams) Endpoints

Base URL: `http://localhost:3002`

### Add Message
**POST** `/messages`

**Request Body:**
```json
{
  "type": "booking",
  "data": {
    "bookingId": "abc-123",
    "userId": "user-123"
  }
}
```

### Get Message Status
**GET** `/messages/:messageId`

### Get Stream Statistics
**GET** `/stats`

### Read Messages
**GET** `/messages?count=10`

## Kafka Service Endpoints

Base URL: `http://localhost:3003`

### Send Message
**POST** `/messages`

**Request Body:**
```json
{
  "type": "booking",
  "data": {
    "bookingId": "abc-123",
    "userId": "user-123"
  }
}
```

### Get Message Status
**GET** `/messages/:messageId`

### Get Topic Statistics
**GET** `/stats`

## Monitoring Service Endpoints

Base URL: `http://localhost:3004`

### Dashboard
**GET** `/dashboard`

Returns comprehensive statistics from all queue systems.

**Response:**
```json
{
  "timestamp": "2024-01-01T10:00:00Z",
  "queues": {
    "bullmq": {
      "waiting": 5,
      "active": 2,
      "completed": 100,
      "failed": 1,
      "delayed": 0
    },
    "redisStreams": {
      "totalMessages": 50,
      "pendingMessages": 3,
      "dlqMessages": 0
    },
    "kafka": {
      "topic": "booking-events",
      "partitions": 3,
      "dlqPartitions": 1
    }
  }
}
```

### Get Queue Details
**GET** `/queue/bullmq` - BullMQ queue details
**GET** `/queue/streams` - Redis Streams details

### Service Health
**GET** `/services/health`

Returns health status of all services.


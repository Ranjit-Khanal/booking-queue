// Common types for booking queue system

// ==================== Booking Types ====================
export interface BookingData {
  bookingId: string;
  userId: string;
  hotelId: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  roomType?: string;
  createdAt: string;
}

export interface BookingRequest {
  userId: string;
  hotelId: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  roomType?: string;
}

// ==================== Enums ====================
export enum EventType {
  BOOKING_CREATED = 'booking.created',
  BOOKING_CONFIRMED = 'booking.confirmed',
  BOOKING_FAILED = 'booking.failed',
  BOOKING_CANCELLED = 'booking.cancelled',
  PAYMENT_PROCESSED = 'payment.processed',
  EMAIL_SENT = 'email.sent',
  PDF_GENERATED = 'pdf.generated',
}

export enum BookingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum RoomType {
  STANDARD = 'standard',
  DELUXE = 'deluxe',
  SUITE = 'suite',
  PRESIDENTIAL = 'presidential',
}

export enum QueueType {
  BULLMQ = 'bullmq',
  REDIS_STREAMS = 'redis-streams',
  KAFKA = 'kafka',
}

// ==================== Queue Types ====================
export interface JobData {
  type: string;
  data: BookingData;
  jobId?: string;
  messageId?: string;
  createdAt?: string;
}

export interface QueueJobOptions {
  attempts?: number;
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  removeOnComplete?: boolean | {
    age?: number;
    count?: number;
  };
  removeOnFail?: boolean | {
    age?: number;
  };
  delay?: number;
}

export interface QueueResponse {
  jobId?: string;
  messageId?: string;
  status: string;
  error?: string;
}

export interface BookingResponse {
  bookingId: string;
  queues: {
    bullmq: QueueResponse;
    redisStreams: QueueResponse;
    kafka: QueueResponse;
  };
}

export interface JobStatus {
  jobId: string;
  name: string;
  state: string;
  progress?: number;
  data?: any;
  returnvalue?: any;
  failedReason?: string;
  attemptsMade?: number;
  timestamp?: number;
}

// ==================== Stream Types ====================
export interface StreamMessage {
  messageId: string;
  streamId?: string;
  data?: any;
  status: string;
}

// ==================== Kafka Types ====================
export interface KafkaMessageMetadata {
  messageId: string;
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
}

// ==================== Statistics Types ====================
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

export interface StreamStats {
  totalMessages: number;
  pendingMessages: number;
  dlqMessages: number;
}

export interface KafkaStats {
  topic: string;
  partitions: number;
  dlqPartitions: number;
  messagesInStore?: number;
}

export interface DashboardData {
  timestamp: string;
  queues: {
    bullmq: QueueStats;
    redisStreams: StreamStats;
    kafka: KafkaStats;
  };
}

// ==================== Health & Monitoring Types ====================
export interface HealthStatus {
  status: string;
  service: string;
  [key: string]: any;
}

export interface ServiceHealth {
  name: string;
  url: string;
  status: string;
  data?: any;
  error?: string;
}

// ==================== Event Types ====================
export interface BookingEvent {
  type: EventType;
  bookingId: string;
  userId: string;
  timestamp: string;
  data?: any;
}

export interface QueueEvent {
  queueType: QueueType;
  event: BookingEvent;
  metadata?: {
    jobId?: string;
    messageId?: string;
    partition?: number;
    offset?: string;
  };
}

// ==================== User Types ====================
export interface User {
  userId: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Hotel {
  hotelId: string;
  name: string;
  location: string;
  rating: number;
}

// ==================== Re-export for convenience ====================
export type BookingType = BookingData;
export type { BookingData as Booking };


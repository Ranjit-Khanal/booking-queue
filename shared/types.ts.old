// Shared types across all services

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

export interface StreamMessage {
  messageId: string;
  streamId?: string;
  data?: any;
  status: string;
}

export interface KafkaMessageMetadata {
  messageId: string;
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
}

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

export interface HealthStatus {
  status: string;
  service: string;
  [key: string]: any;
}


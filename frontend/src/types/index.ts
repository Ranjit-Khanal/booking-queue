// Frontend types matching backend types

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

export interface BookingStatus {
  bookingId: string;
  status: {
    bullmq: JobStatus | null;
    redisStreams: any | null;
    kafka: any | null;
  };
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

export interface ServiceHealth {
  name: string;
  url: string;
  status: string;
  data?: any;
  error?: string;
}


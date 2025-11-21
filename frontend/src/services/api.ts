import axios from 'axios';
import type {
  BookingRequest,
  BookingResponse,
  BookingStatus,
  DashboardData,
  JobStatus,
  QueueStats,
  ServiceHealth
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const QUEUE_BASE_URL = import.meta.env.VITE_QUEUE_URL || 'http://localhost:3001';
const MONITORING_BASE_URL = import.meta.env.VITE_MONITORING_URL || 'http://localhost:3004';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const queueClient = axios.create({
  baseURL: QUEUE_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const monitoringClient = axios.create({
  baseURL: MONITORING_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const bookingApi = {
  // Create a new booking
  createBooking: async (data: BookingRequest): Promise<BookingResponse> => {
    const response = await apiClient.post<BookingResponse>('/api/bookings', data);
    return response.data;
  },

  // Create a delayed booking
  createDelayedBooking: async (
    data: BookingRequest & { delaySeconds?: number }
  ): Promise<any> => {
    const response = await apiClient.post('/api/bookings/delayed', data);
    return response.data;
  },

  // Get booking status
  getBookingStatus: async (bookingId: string): Promise<BookingStatus> => {
    const response = await apiClient.get<BookingStatus>(`/api/bookings/${bookingId}/status`);
    return response.data;
  },
};

export const queueApi = {
  // Get BullMQ queue statistics
  getQueueStats: async (): Promise<{ queue: string; stats: QueueStats }> => {
    const response = await queueClient.get('/stats');
    return response.data;
  },

  // Get job status
  getJobStatus: async (jobId: string): Promise<JobStatus> => {
    const response = await queueClient.get<JobStatus>(`/jobs/${jobId}`);
    return response.data;
  },

  // Get jobs by state
  getJobsByState: async (state: string): Promise<{ state: string; jobs: any[] }> => {
    const response = await queueClient.get(`/jobs/state/${state}`);
    return response.data;
  },
};

export const monitoringApi = {
  // Get dashboard data
  getDashboard: async (): Promise<DashboardData> => {
    const response = await monitoringClient.get<DashboardData>('/dashboard');
    return response.data;
  },

  // Get service health
  getServiceHealth: async (): Promise<{ timestamp: string; services: ServiceHealth[] }> => {
    const response = await monitoringClient.get('/services/health');
    return response.data;
  },

  // Get BullMQ queue details
  getBullMQDetails: async (): Promise<any> => {
    const response = await monitoringClient.get('/queue/bullmq');
    return response.data;
  },

  // Get Redis Streams details
  getStreamsDetails: async (): Promise<any> => {
    const response = await monitoringClient.get('/queue/streams');
    return response.data;
  },
};


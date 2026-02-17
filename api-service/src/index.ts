import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { BookingData } from './shared/index';
import AllRouter from './routes/routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || '3000';

// Service URLs
export  const QUEUE_SERVICE_URL = process.env.QUEUE_SERVICE_URL || 'http://localhost:3001';
export  const STREAM_SERVICE_URL = process.env.STREAM_SERVICE_URL || 'http://localhost:3002';
export  const KAFKA_SERVICE_URL = process.env.KAFKA_SERVICE_URL || 'http://localhost:3003';

app.use(cors());
app.use(express.json());

interface BookingRequest {
  userId: string;
  hotelId: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  roomType?: string;
}



app.use(AllRouter);
// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'api-service' });
});





app.listen(parseInt(PORT), () => {
  console.log(`🚀 API Service running on port ${PORT}`);
  console.log(`📡 Queue Service: ${QUEUE_SERVICE_URL}`);
  console.log(`📡 Stream Service: ${STREAM_SERVICE_URL}`);
  console.log(`📡 Kafka Service: ${KAFKA_SERVICE_URL}`);
});


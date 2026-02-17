
import axios from 'axios';
import { Request, Response } from 'express';
import { BookingData, BookingRequest, BookingResponse, QueueResponse } from '../shared/index';
import { v4 as uuidv4 } from 'uuid';
import { KAFKA_SERVICE_URL, QUEUE_SERVICE_URL, STREAM_SERVICE_URL } from '../index';


export const createBookings = async (req: Request<{}, BookingResponse, BookingRequest>, res: Response) => {
    try {
        const { userId, hotelId, checkIn, checkOut, guests, roomType } = req.body;

        // Validation
        if (!userId || !hotelId || !checkIn || !checkOut) {
            return res.status(400).json({
                error: 'Missing required fields: userId, hotelId, checkIn, checkOut'
            } as any);
        }

        const bookingId = uuidv4();
        const bookingData: BookingData = {
            bookingId,
            userId,
            hotelId,
            checkIn,
            checkOut,
            guests: guests || 1,
            roomType: roomType || 'standard',
            createdAt: new Date().toISOString()
        };

        // Publish to all three queue systems in parallel
        const [bullmqResult, streamsResult, kafkaResult] = await Promise.allSettled([
            axios.post(`${QUEUE_SERVICE_URL}/jobs`, {
                type: 'booking',
                data: bookingData,
                options: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000
                    },
                    removeOnComplete: true,
                    removeOnFail: false
                }
            }),
            axios.post(`${STREAM_SERVICE_URL}/messages`, {
                type: 'booking',
                data: bookingData
            }),
            axios.post(`${KAFKA_SERVICE_URL}/messages`, {
                type: 'booking',
                data: bookingData
            })
        ]);

        const results: BookingResponse = {
            bookingId,
            queues: {
                bullmq: bullmqResult.status === 'fulfilled'
                    ? { jobId: bullmqResult.value.data.jobId, status: 'queued' } as QueueResponse
                    : { error: (bullmqResult as PromiseRejectedResult).reason?.message || 'Unknown error', status: 'error' } as QueueResponse,
                redisStreams: streamsResult.status === 'fulfilled'
                    ? { messageId: streamsResult.value.data.messageId, status: 'queued' } as QueueResponse
                    : { error: (streamsResult as PromiseRejectedResult).reason?.message || 'Unknown error', status: 'error' } as QueueResponse,
                kafka: kafkaResult.status === 'fulfilled'
                    ? { messageId: kafkaResult.value.data.messageId, status: 'queued' } as QueueResponse
                    : { error: (kafkaResult as PromiseRejectedResult).reason?.message || 'Unknown error', status: 'error' } as QueueResponse
            }
        };

        return res.status(201).json(results);
    } catch (error) {
        const err = error as Error;
        console.error('Error creating booking:', err);
        return res.status(500).json({ error: 'Failed to create booking', message: err.message } as any);
    }
}
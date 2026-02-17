import axios from 'axios';
import { Request, Response } from 'express';
import { BookingData, BookingRequest } from '../shared/index';
import { v4 as uuidv4 } from 'uuid';
import { QUEUE_SERVICE_URL } from '../index';


interface DelayedBookingRequest extends BookingRequest {
  delaySeconds?: number;
}

export const createDelayedBookings = async (req: Request<{}, any, DelayedBookingRequest>, res: Response) => {
  try {
    const { userId, hotelId, checkIn, checkOut, delaySeconds = 10 } = req.body;

    if (!userId || !hotelId || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const bookingId = uuidv4();
    const bookingData: BookingData = {
      bookingId,
      userId,
      hotelId,
      checkIn,
      checkOut,
      createdAt: new Date().toISOString()
    };

    // Only BullMQ supports delayed jobs natively
    const result = await axios.post(`${QUEUE_SERVICE_URL}/jobs/delayed`, {
      type: 'booking',
      data: bookingData,
      delay: delaySeconds * 1000 // Convert to milliseconds
    });

   return res.status(201).json({
      bookingId,
      delaySeconds,
      jobId: result.data.jobId,
      message: `Booking will be processed in ${delaySeconds} seconds`
    });
  } catch (error) {
    const err = error as Error;
    return res.status(500).json({ error: 'Failed to create delayed booking', message: err.message } as any);
  }
}
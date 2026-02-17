import express from 'express';
import { createBookings } from '../controllers/createBookings.controller';
import { getBookingStatus } from '../controllers/getBookingStatus.controller';
import { createDelayedBookings } from '../controllers/createDelayedBookings.controller';

const router = express.Router();

// Create booking - publishes to all three queue types
router.post('/api/bookings', createBookings);

// Get booking status (from all queues)
router.get('/api/bookings/:bookingId/status', getBookingStatus);

// Create delayed booking (for testing delayed jobs)
router.post('/api/bookings/delayed', createDelayedBookings
);
export default router;
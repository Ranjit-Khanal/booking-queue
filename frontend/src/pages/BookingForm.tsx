import { useState } from 'react';
import { bookingApi } from '../services/api';
import type { BookingRequest, BookingResponse } from '../types';
import '../styles/BookingForm.css';

/**
 * Renders a booking creation form with inputs for user ID, hotel ID, check-in/check-out dates, guests, and room type; supports an optional delayed scheduling mode and displays submission results including per-queue status for BullMQ, Redis Streams, and Kafka.
 *
 * @returns The JSX element for the booking form UI.
 */
export default function BookingForm() {
  const [formData, setFormData] = useState<BookingRequest>({
    userId: '',
    hotelId: '',
    checkIn: '',
    checkOut: '',
    guests: 1,
    roomType: 'standard',
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BookingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [delayedMode, setDelayedMode] = useState(false);
  const [delaySeconds, setDelaySeconds] = useState(10);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'guests' ? parseInt(value) || 1 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let response: BookingResponse;
      if (delayedMode) {
        const delayedResponse = await bookingApi.createDelayedBooking({
          ...formData,
          delaySeconds,
        });
        response = delayedResponse as BookingResponse;
      } else {
        response = await bookingApi.createBooking(formData);
      }

      setResult(response);
      // Reset form after successful submission
      setFormData({
        userId: '',
        hotelId: '',
        checkIn: '',
        checkOut: '',
        guests: 1,
        roomType: 'standard',
      });
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="booking-form-container">
      <h2>➕ Create New Booking</h2>
      <p className="form-description">
        Create a booking that will be processed by all three queue systems: BullMQ, Redis Streams, and Kafka
      </p>

      <div className="mode-toggle">
        <label>
          <input
            type="checkbox"
            checked={delayedMode}
            onChange={(e) => setDelayedMode(e.target.checked)}
          />
          <span>Delayed Booking (BullMQ only)</span>
        </label>
        {delayedMode && (
          <div className="delay-input">
            <label>
              Delay (seconds):
              <input
                type="number"
                min="1"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(parseInt(e.target.value) || 10)}
              />
            </label>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="booking-form">
        <div className="form-group">
          <label htmlFor="userId">User ID *</label>
          <input
            type="text"
            id="userId"
            name="userId"
            value={formData.userId}
            onChange={handleChange}
            required
            placeholder="user-123"
          />
        </div>

        <div className="form-group">
          <label htmlFor="hotelId">Hotel ID *</label>
          <input
            type="text"
            id="hotelId"
            name="hotelId"
            value={formData.hotelId}
            onChange={handleChange}
            required
            placeholder="hotel-456"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="checkIn">Check-in Date *</label>
            <input
              type="date"
              id="checkIn"
              name="checkIn"
              value={formData.checkIn}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="checkOut">Check-out Date *</label>
            <input
              type="date"
              id="checkOut"
              name="checkOut"
              value={formData.checkOut}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="guests">Number of Guests</label>
            <input
              type="number"
              id="guests"
              name="guests"
              value={formData.guests}
              onChange={handleChange}
              min="1"
              max="10"
            />
          </div>

          <div className="form-group">
            <label htmlFor="roomType">Room Type</label>
            <select
              id="roomType"
              name="roomType"
              value={formData.roomType}
              onChange={handleChange}
            >
              <option value="standard">Standard</option>
              <option value="deluxe">Deluxe</option>
              <option value="suite">Suite</option>
              <option value="presidential">Presidential</option>
            </select>
          </div>
        </div>

        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? 'Creating...' : delayedMode ? 'Schedule Delayed Booking' : 'Create Booking'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="result-card">
          <h3>✅ Booking Created Successfully!</h3>
          <div className="result-info">
            <p><strong>Booking ID:</strong> {result.bookingId}</p>
          </div>
          <div className="queue-results">
            <h4>Queue Status:</h4>
            <div className="queue-status-grid">
              <div className={`queue-status-item ${result.queues.bullmq.status === 'queued' ? 'success' : 'error'}`}>
                <strong>BullMQ:</strong>
                {result.queues.bullmq.jobId ? (
                  <span>Job ID: {result.queues.bullmq.jobId}</span>
                ) : (
                  <span>Error: {result.queues.bullmq.error}</span>
                )}
              </div>
              <div className={`queue-status-item ${result.queues.redisStreams.status === 'queued' ? 'success' : 'error'}`}>
                <strong>Redis Streams:</strong>
                {result.queues.redisStreams.messageId ? (
                  <span>Message ID: {result.queues.redisStreams.messageId}</span>
                ) : (
                  <span>Error: {result.queues.redisStreams.error}</span>
                )}
              </div>
              <div className={`queue-status-item ${result.queues.kafka.status === 'queued' ? 'success' : 'error'}`}>
                <strong>Kafka:</strong>
                {result.queues.kafka.messageId ? (
                  <span>Message ID: {result.queues.kafka.messageId}</span>
                ) : (
                  <span>Error: {result.queues.kafka.error}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

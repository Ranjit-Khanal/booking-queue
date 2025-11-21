import { useState } from 'react';
import { bookingApi } from '../services/api';
import type { BookingStatus as BookingStatusType } from '../types';
import '../styles/BookingStatus.css';

/**
 * Render a UI to check and display a booking's status across BullMQ, Redis Streams, and Kafka.
 *
 * Manages local input, loading, error, and fetched status state; submits a booking ID to retrieve
 * status information and presents per-queue details such as state, progress, attempts, errors,
 * return value, stream IDs, partitions, and offsets.
 *
 * @returns The component's JSX output containing the booking ID form, optional error message,
 * and detailed status cards for each supported queue system.
 */
export default function BookingStatus() {
  const [bookingId, setBookingId] = useState('');
  const [status, setStatus] = useState<BookingStatusType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId.trim()) return;

    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const result = await bookingApi.getBookingStatus(bookingId);
      setStatus(result);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch booking status');
    } finally {
      setLoading(false);
    }
  };

  const getStateColor = (state: string) => {
    switch (state?.toLowerCase()) {
      case 'completed':
        return 'completed';
      case 'active':
        return 'active';
      case 'failed':
        return 'failed';
      case 'waiting':
        return 'waiting';
      default:
        return '';
    }
  };

  return (
    <div className="booking-status-container">
      <h2>🔍 Check Booking Status</h2>
      <p className="status-description">
        Enter a booking ID to check its status across all queue systems
      </p>

      <form onSubmit={handleSubmit} className="status-form">
        <div className="form-group">
          <label htmlFor="bookingId">Booking ID</label>
          <input
            type="text"
            id="bookingId"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            placeholder="Enter booking ID..."
            required
          />
        </div>
        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? 'Checking...' : 'Check Status'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {status && (
        <div className="status-results">
          <h3>Status for Booking: {status.bookingId}</h3>
          
          <div className="queue-status-cards">
            {/* BullMQ Status */}
            <div className="queue-status-card">
              <h4>🔄 BullMQ</h4>
              {status.status.bullmq ? (
                <div className="status-details">
                  <div className="status-item">
                    <span className="label">State:</span>
                    <span className={`value ${getStateColor(status.status.bullmq.state)}`}>
                      {status.status.bullmq.state}
                    </span>
                  </div>
                  {status.status.bullmq.progress !== undefined && (
                    <div className="status-item">
                      <span className="label">Progress:</span>
                      <span className="value">{status.status.bullmq.progress}%</span>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${status.status.bullmq.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {status.status.bullmq.attemptsMade !== undefined && (
                    <div className="status-item">
                      <span className="label">Attempts:</span>
                      <span className="value">{status.status.bullmq.attemptsMade}</span>
                    </div>
                  )}
                  {status.status.bullmq.failedReason && (
                    <div className="status-item error">
                      <span className="label">Error:</span>
                      <span className="value">{status.status.bullmq.failedReason}</span>
                    </div>
                  )}
                  {status.status.bullmq.returnvalue && (
                    <div className="status-item success">
                      <span className="label">Result:</span>
                      <pre className="value">{JSON.stringify(status.status.bullmq.returnvalue, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-status">No status available</div>
              )}
            </div>

            {/* Redis Streams Status */}
            <div className="queue-status-card">
              <h4>🌊 Redis Streams</h4>
              {status.status.redisStreams ? (
                <div className="status-details">
                  <div className="status-item">
                    <span className="label">Status:</span>
                    <span className="value">{status.status.redisStreams.status || 'Unknown'}</span>
                  </div>
                  {status.status.redisStreams.streamId && (
                    <div className="status-item">
                      <span className="label">Stream ID:</span>
                      <span className="value">{status.status.redisStreams.streamId}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-status">No status available</div>
              )}
            </div>

            {/* Kafka Status */}
            <div className="queue-status-card">
              <h4>📨 Kafka</h4>
              {status.status.kafka ? (
                <div className="status-details">
                  <div className="status-item">
                    <span className="label">Status:</span>
                    <span className="value">{status.status.kafka.status || 'Unknown'}</span>
                  </div>
                  {status.status.kafka.partition !== undefined && (
                    <div className="status-item">
                      <span className="label">Partition:</span>
                      <span className="value">{status.status.kafka.partition}</span>
                    </div>
                  )}
                  {status.status.kafka.offset && (
                    <div className="status-item">
                      <span className="label">Offset:</span>
                      <span className="value">{status.status.kafka.offset}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-status">No status available</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

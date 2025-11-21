import { useState, useEffect } from 'react';
import { monitoringApi } from '../services/api';
import type { DashboardData, ServiceHealth } from '../types';
import { format } from 'date-fns';
import '../styles/Dashboard.css';

/**
 * Render the System Dashboard page showing service health, queue statistics, and a last-updated timestamp.
 *
 * The component fetches dashboard metrics and service health from the monitoring API, updates view state, and refreshes data periodically (every 5 seconds). It also exposes a manual refresh button and displays loading or error states when appropriate.
 *
 * @returns The JSX element containing the dashboard UI.
 */
export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const [dashboard, health] = await Promise.all([
        monitoringApi.getDashboard(),
        monitoringApi.getServiceHealth(),
      ]);
      setDashboardData(dashboard);
      setServiceHealth(health.services);
      setError(null);
    } catch (err) {
      setError('Failed to fetch dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading && !dashboardData) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error && !dashboardData) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>📊 System Dashboard</h2>
        <button onClick={fetchDashboard} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      {dashboardData && (
        <>
          <div className="timestamp">
            Last updated: {format(new Date(dashboardData.timestamp), 'PPpp')}
          </div>

          {/* Service Health */}
          <section className="health-section">
            <h3>Service Health</h3>
            <div className="health-grid">
              {serviceHealth.map((service) => (
                <div
                  key={service.name}
                  className={`health-card ${service.status === 'healthy' ? 'healthy' : 'unhealthy'}`}
                >
                  <div className="health-status">
                    {service.status === 'healthy' ? '✅' : '❌'}
                  </div>
                  <div className="health-name">{service.name}</div>
                  <div className="health-status-text">{service.status}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Queue Statistics */}
          <section className="queues-section">
            <h3>Queue Statistics</h3>
            <div className="queues-grid">
              {/* BullMQ */}
              <div className="queue-card">
                <div className="queue-header">
                  <h4>🔄 BullMQ</h4>
                  <span className="queue-badge">Redis-based Queue</span>
                </div>
                <div className="queue-stats">
                  <div className="stat-item">
                    <span className="stat-label">Waiting:</span>
                    <span className="stat-value">{dashboardData.queues.bullmq.waiting}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Active:</span>
                    <span className="stat-value active">{dashboardData.queues.bullmq.active}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Completed:</span>
                    <span className="stat-value completed">{dashboardData.queues.bullmq.completed}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Failed:</span>
                    <span className="stat-value failed">{dashboardData.queues.bullmq.failed}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Delayed:</span>
                    <span className="stat-value delayed">{dashboardData.queues.bullmq.delayed}</span>
                  </div>
                  <div className="stat-item total">
                    <span className="stat-label">Total:</span>
                    <span className="stat-value">{dashboardData.queues.bullmq.total}</span>
                  </div>
                </div>
              </div>

              {/* Redis Streams */}
              <div className="queue-card">
                <div className="queue-header">
                  <h4>🌊 Redis Streams</h4>
                  <span className="queue-badge">Consumer Groups</span>
                </div>
                <div className="queue-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total Messages:</span>
                    <span className="stat-value">{dashboardData.queues.redisStreams.totalMessages}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Pending:</span>
                    <span className="stat-value active">{dashboardData.queues.redisStreams.pendingMessages}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">DLQ Messages:</span>
                    <span className="stat-value failed">{dashboardData.queues.redisStreams.dlqMessages}</span>
                  </div>
                </div>
              </div>

              {/* Kafka */}
              <div className="queue-card">
                <div className="queue-header">
                  <h4>📨 Kafka</h4>
                  <span className="queue-badge">Event Log</span>
                </div>
                <div className="queue-stats">
                  <div className="stat-item">
                    <span className="stat-label">Topic:</span>
                    <span className="stat-value">{dashboardData.queues.kafka.topic}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Partitions:</span>
                    <span className="stat-value">{dashboardData.queues.kafka.partitions}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">DLQ Partitions:</span>
                    <span className="stat-value">{dashboardData.queues.kafka.dlqPartitions}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

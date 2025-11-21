import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useState } from 'react';
import BookingForm from './pages/BookingForm';
import Dashboard from './pages/Dashboard';
import BookingStatus from './pages/BookingStatus';
import './styles/App.css';

/**
 * Root application component that sets up routing, top-level layout, and navigation for the booking system.
 *
 * The component renders a header, a navigation bar with three links (Dashboard, Create Booking, Check Status) whose visual active state is tracked via local `activeTab` state, a main area that maps routes to `Dashboard`, `BookingForm`, and `BookingStatus` pages, and a footer.
 *
 * @returns The application's root JSX element containing the Router, layout, navigation, and routed pages.
 */
function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <div className="container">
            <h1>🏨 Distributed Booking Queue System</h1>
            <p className="subtitle">Monitor and manage bookings across BullMQ, Redis Streams, and Kafka</p>
          </div>
        </header>

        <nav className="app-nav">
          <div className="container">
            <Link
              to="/"
              className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Dashboard
            </Link>
            <Link
              to="/bookings/create"
              className={`nav-link ${activeTab === 'create' ? 'active' : ''}`}
              onClick={() => setActiveTab('create')}
            >
              ➕ Create Booking
            </Link>
            <Link
              to="/bookings/status"
              className={`nav-link ${activeTab === 'status' ? 'active' : ''}`}
              onClick={() => setActiveTab('status')}
            >
              🔍 Check Status
            </Link>
          </div>
        </nav>

        <main className="app-main">
          <div className="container">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/bookings/create" element={<BookingForm />} />
              <Route path="/bookings/status" element={<BookingStatus />} />
            </Routes>
          </div>
        </main>

        <footer className="app-footer">
          <div className="container">
            <p>Distributed Booking Queue System - Built with React, TypeScript, BullMQ, Redis Streams, and Kafka</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;

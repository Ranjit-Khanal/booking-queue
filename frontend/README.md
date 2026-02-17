# Booking Queue Frontend

React + TypeScript frontend for the Distributed Booking Queue System.

## Features

- 📊 **Dashboard** - Real-time monitoring of all queue systems (BullMQ, Redis Streams, Kafka)
- ➕ **Create Bookings** - Create bookings that are processed by all three queue systems
- 🔍 **Check Status** - View booking status across all queue systems
- 🎨 **Modern UI** - Clean, responsive design with real-time updates

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Navigation
- **Axios** - HTTP client
- **date-fns** - Date formatting

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
cd frontend
npm install
```

### Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Environment Variables

Create a `.env` file:

```env
VITE_API_URL=http://localhost:3000
VITE_QUEUE_URL=http://localhost:3001
VITE_MONITORING_URL=http://localhost:3004
```

## Docker

The frontend is containerized with Nginx for production:

```bash
docker-compose up frontend
```

Access at `http://localhost:5173`

## Project Structure

```
frontend/
├── src/
│   ├── components/     # Reusable components
│   ├── pages/          # Page components
│   │   ├── Dashboard.tsx
│   │   ├── BookingForm.tsx
│   │   └── BookingStatus.tsx
│   ├── services/       # API clients
│   │   └── api.ts
│   ├── types/          # TypeScript types
│   │   └── index.ts
│   ├── styles/         # CSS files
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point
├── public/             # Static assets
├── index.html          # HTML template
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript configuration
└── package.json       # Dependencies
```

## Features in Detail

### Dashboard

- Real-time queue statistics (auto-refreshes every 5 seconds)
- Service health monitoring
- Queue metrics for BullMQ, Redis Streams, and Kafka
- Visual indicators for queue states

### Create Booking

- Form to create new bookings
- Support for delayed bookings (BullMQ only)
- Real-time feedback on queue submission
- Shows job/message IDs for all three queues

### Check Status

- Search bookings by ID
- View status across all queue systems
- Progress tracking for BullMQ jobs
- Error messages and retry information

## API Integration

The frontend communicates with:

- **API Service** (`/api`) - Booking creation and status
- **Queue Service** (`/queue`) - BullMQ operations
- **Monitoring Service** (`/monitoring`) - Dashboard data

All API calls are typed with TypeScript for type safety.


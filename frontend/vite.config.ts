import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://api-service:3000',
        changeOrigin: true,
      },
      '/queue': {
        target: 'http://queue-service:3001',
        changeOrigin: true,
      },
      '/stream': {
        target: 'http://stream-service:3002',
        changeOrigin: true,
      },
      '/kafka': {
        target: 'http://kafka-service:3003',
        changeOrigin: true,
      },
      '/monitoring': {
        target: 'http://monitoring-service:3004',
        changeOrigin: true,
      }
    }
  }
})


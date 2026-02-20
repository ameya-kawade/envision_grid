import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/health': 'http://127.0.0.1:8000',
      '/ingest': 'http://127.0.0.1:8000',
      '/predict': 'http://127.0.0.1:8000',
      '/predictions': 'http://127.0.0.1:8000',
      '/alerts': 'http://127.0.0.1:8000',
      '/cases': 'http://127.0.0.1:8000',
      '/hotspots': 'http://127.0.0.1:8000',
      '/coverage': 'http://127.0.0.1:8000',
      '/simulate': 'http://127.0.0.1:8000',
      '/map-data': 'http://127.0.0.1:8000',
      '/grid': 'http://127.0.0.1:8000',
    },
  },
})

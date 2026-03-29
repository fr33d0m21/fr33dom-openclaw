import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendTarget = process.env.FR33D0M_OPENCLAW_BACKEND || 'http://127.0.0.1:18643'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/openclaw': {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
      },
      '/terminal': {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})

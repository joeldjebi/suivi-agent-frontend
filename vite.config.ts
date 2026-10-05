import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    // Le temps réel (Socket.IO) se connecte directement à l'API en développement
    // (voir src/lib/socket.tsx) : pas de WebSocket relayé par Vite.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})

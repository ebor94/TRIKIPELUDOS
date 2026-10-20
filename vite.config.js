import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

const destino = process.env.VITE_PROXY_TARGET || 'http://localhost:3020'

export default defineConfig({
  base: '/trikipeludos/',
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: {
    port: Number(process.env.VITE_PORT || 5173),
    proxy: {
      '/api': { target: destino, changeOrigin: true },
      '/uploads': { target: destino, changeOrigin: true },
      '/socket.io': { target: destino, changeOrigin: true, ws: true }
    }
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/__tests__/*.spec.js'],
    setupFiles: ['./src/testing/setup.js']
  }
})

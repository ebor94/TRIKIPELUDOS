import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

const destino = process.env.VITE_PROXY_TARGET || 'http://localhost:3020'

export default defineConfig({
  base: '/trikipeludos/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'TRIKIPELUDOS',
        short_name: 'TRIKIPELUDOS',
        start_url: '/trikipeludos/jurado',
        scope: '/trikipeludos/',
        display: 'standalone',
        background_color: '#FFF6E6',
        theme_color: '#47206A',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }]
      },
      workbox: {
        // Solo el shell: los datos van por la cola de IndexedDB, no por el service worker (D13).
        globPatterns: ['**/*.{js,css,html,svg,webp}'],
        navigateFallback: '/trikipeludos/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//, /^\/uploads\//]
      }
    })
  ],
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

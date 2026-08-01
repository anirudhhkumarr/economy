import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: '/economy/',
  server: {
    proxy: {
      '/economy/api/fred': {
        target: 'https://fred.stlouisfed.org',
        changeOrigin: true,
        secure: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        rewrite: (path) => path.replace(/^\/economy\/api\/fred/, '')
      },
      '/economy/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        secure: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        rewrite: (path) => path.replace(/^\/economy\/api\/yahoo/, '')
      }
    }
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: {
      '/economy/api/fred': {
        target: 'https://fred.stlouisfed.org',
        changeOrigin: true,
        secure: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        rewrite: (path) => path.replace(/^\/economy\/api\/fred/, '')
      },
      '/economy/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        secure: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        rewrite: (path) => path.replace(/^\/economy\/api\/yahoo/, '')
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 20000, // External APIs take time
  }
})

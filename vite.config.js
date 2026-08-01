import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Fully static SPA — data is baked into public/data/macro.json at build time.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: '/economy/',
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  }
})

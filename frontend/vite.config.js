import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BASE = process.env.VITE_BASE_PATH || '/oog/'

export default defineConfig({
  plugins: [react()],
  base: BASE,
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/oog/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/oog/, ''),
      },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3008,
    host: '0.0.0.0',
    open: true,
    // Proxy local: redirige /api al API Gateway (mismo comportamiento que nginx en prod)
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'development-content-security-policy',
    transformIndexHtml(html, context) {
      return context.server ? html.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';").replace("connect-src 'self' http://localhost:3001;", "connect-src 'self' http://localhost:3001 ws://localhost:3000;") : html;
    },
  }],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    proxy: { '/api': 'http://localhost:3001' },
  },
  optimizeDeps: {
    include: ['react-router-dom'],
  },
}) 

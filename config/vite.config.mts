import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// https://vitejs.dev/config/
export default defineConfig({
  root: path.join(projectRoot, 'src'),
  envDir: projectRoot,
  plugins: [react(), {
    name: 'development-content-security-policy',
    transformIndexHtml(html, context) {
      if (!context.server) return html;
      const iconPath = '/@fs/' + path.join(projectRoot, 'assets/icon.png.png').replaceAll('\\', '/');
      return html
        .replace("script-src 'self';", "script-src 'self' 'unsafe-inline';")
        .replace("connect-src 'self' http://localhost:3001;", "connect-src 'self' http://localhost:3001 ws://localhost:3000;")
        .replace('href="../assets/icon.png.png"', `href="${iconPath}"`);
    },
  }],
  base: './',
  build: {
    outDir: path.join(projectRoot, 'dist'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': projectRoot,
    },
  },
  css: { postcss: path.join(projectRoot, 'config') },
  server: {
    port: 3000,
    strictPort: true,
    proxy: { '/api': 'http://localhost:3001' },
  },
  optimizeDeps: {
    include: ['react-router-dom'],
  },
}) 

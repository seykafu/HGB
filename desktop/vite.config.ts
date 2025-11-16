import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for Electron
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't delete main.js and preload.js
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  server: {
    port: 5173,
  },
  // Expose environment variables to the client
  // Variables prefixed with VITE_ are available in the renderer process
  envPrefix: 'VITE_',
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest'
import path from 'path'

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        inject: path.resolve(__dirname, 'src/inject/index.tsx'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'inject') {
            return 'inject/index.js'
          }
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'index.css' && assetInfo.src?.includes('inject')) {
            return 'inject/index.css'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})

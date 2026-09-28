import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    // Modern browsers only → smaller output, no legacy transpilation.
    target: 'es2020',
    rollupOptions: {
      output: {
        // Split heavy libs into their own cached chunks so an app-code change
        // doesn't bust the (rarely-changing) vendor chunk, and the browser can
        // reuse them across route navigations.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react-vendor'
          if (/[\\/]node_modules[\\/](html2canvas|jspdf)[\\/]/.test(id)) return 'pdf-vendor'
          if (/[\\/]node_modules[\\/]recharts[\\/]/.test(id)) return 'chart-vendor'
        },
      },
    },
    // The chart/pdf vendor chunks are intentionally large; raise the threshold
    // so the build log isn't noisy.
    chunkSizeWarningLimit: 700,
  },
})

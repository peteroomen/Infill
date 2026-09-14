import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2022',
    // The single-file build has nowhere to fetch assets from, so everything is
    // inlined as a data URI. Normal builds keep them separate, for caching.
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
  },
}))

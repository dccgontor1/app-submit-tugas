import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
  tailwindcss()
  ],
  // Tauri options
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],

  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux

    // Target modern browsers supporting destructuring
    target: ['es2022', 'chrome100', 'safari15', 'firefox100'],
    // Minify with esbuild instead of legacy transforms if needed
    minify: 'esbuild',
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})

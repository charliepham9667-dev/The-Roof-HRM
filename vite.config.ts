import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/gsheets-proxy": {
        target: "https://docs.google.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gsheets-proxy/, ""),
      },
    },
  },
})

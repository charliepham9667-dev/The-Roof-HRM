import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Register SW as early as possible (critical for mobile push)
      injectRegister: 'inline',
      // Use injectManifest so we can ship a custom service worker with push handlers
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        name: 'The Roof HRM',
        short_name: 'Roof HRM',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
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
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return

          const modulePath = id.split("node_modules/")[1] || ""
          const packageName = modulePath.startsWith("@")
            ? modulePath.split("/").slice(0, 2).join("/")
            : modulePath.split("/")[0]

          if (packageName.startsWith("@supabase")) return "vendor-supabase"
          if (packageName === "recharts") return "vendor-charts"
          if (packageName.startsWith("@dnd-kit")) return "vendor-dnd"
          if (packageName === "react-router" || packageName === "react-router-dom") return "vendor-router"
          if (packageName.startsWith("@radix-ui") || packageName === "cmdk" || packageName === "vaul") return "vendor-ui"
          if (packageName.startsWith("@tanstack")) return "vendor-tanstack"
          if (packageName === "date-fns" || packageName === "react-day-picker") return "vendor-date"
          if (packageName === "lucide-react") return "vendor-icons"
          if (packageName === "react" || packageName === "react-dom" || packageName === "scheduler") return "vendor-react"

          return "vendor"
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})

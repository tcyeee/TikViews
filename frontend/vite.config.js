import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// 后端使用独立的 BACKEND_PORT（默认 3001），与前端开发服务器的 SERVER_PORT 解耦。
// 不要用 SERVER_PORT 作为后端目标：Conductor 会把 SERVER_PORT 同时注入给前后端，
// 导致后端也去监听 3000 与前端撞端口，进而让 /ws 代理回环到 Vite 自身、引发 write EPIPE。
const backendPort = process.env.BACKEND_PORT || 3001

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
      '/ws': {
        target: `ws://localhost:${backendPort}`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})

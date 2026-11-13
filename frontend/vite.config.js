import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 后端端口可能被运行环境（如 Conductor 的 SERVER_PORT）覆盖，
// 代理目标需要跟后端实际监听的端口保持一致，否则会出现 502。
const backendPort = process.env.SERVER_PORT || 3001

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
})

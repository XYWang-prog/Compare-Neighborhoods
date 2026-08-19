import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 开发环境的 key 从 .env.local 读取（.env.local 不进 git）
  // 生产环境不打包任何 key，由 Vercel 服务端函数持有
  const env = loadEnv(mode, process.cwd(), '')
  const googleKey = env.GOOGLE_GEOCODE_KEY || ''
  const openaiKey = env.OPENAI_KEY || ''

  // 往 Google 请求的查询串里追加 key
  const withKey = (pathname: string, search: string) =>
    `${pathname}${search}${search ? '&' : '?'}key=${encodeURIComponent(googleKey)}`

  return {
    plugins: [react()],
    // Vercel 部署在根路径（如需换回 GitHub Pages，改回 '/nyc-rental-finder/'）
    base: '/',
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        // 与生产环境 /api/* 路径保持一致：
        // 开发时由 vite 代理转发到 Google/OpenAI 并注入 key，
        // 生产时由 Vercel serverless 函数处理。
        '/api/geocode': {
          target: 'https://maps.googleapis.com',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const u = new URL(req.url || '', 'http://localhost')
              proxyReq.path = withKey('/maps/api/geocode/json', u.search)
            })
          },
        },
        '/api/distance': {
          target: 'https://maps.googleapis.com',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const u = new URL(req.url || '', 'http://localhost')
              proxyReq.path = withKey('/maps/api/distancematrix/json', u.search)
            })
          },
        },
        '/api/chat': {
          target: 'https://api.openai.com',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${openaiKey}`)
              proxyReq.path = '/v1/chat/completions'
            })
          },
        },
      },
    },
  }
})

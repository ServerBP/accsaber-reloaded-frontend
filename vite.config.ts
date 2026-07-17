import { fileURLToPath, URL } from 'node:url'
import http from 'node:http'
import https from 'node:https'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

function apiProxy(target: string): Plugin {
  const url = new URL(target)
  const isHttps = url.protocol === 'https:'
  const requester = isHttps ? https : http

  return {
    name: 'api-proxy',
    configureServer(server) {
      server.middlewares.use('/v1', (req, res) => {
        const opts = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: '/v1' + (req.url ?? ''),
          method: req.method,
          headers: {
            ...req.headers,
            host: url.hostname,
          },
        }
        delete (opts.headers as Record<string, unknown>).cookie
        const proxyReq = requester.request(opts, (proxyRes) => {
          res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
          proxyRes.pipe(res)
        })
        proxyReq.on('error', (err) => {
          console.error('[api-proxy]', err.message)
          res.writeHead(502)
          res.end('Proxy error')
        })
        req.pipe(proxyReq)
      })
    },
  }
}

function externalProxy(prefix: string, target: string): Plugin {
  const url = new URL(target)
  const requester = url.protocol === 'https:' ? https : http

  return {
    name: `proxy-${prefix.replace(/\//g, '-')}`,
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(prefix)) return next()
        const path = req.url.slice(prefix.length)
        const opts = {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path,
          method: req.method,
          headers: {
            'accept': 'application/json',
            'host': url.hostname,
          },
        }
        const proxyReq = requester.request(opts, (proxyRes) => {
          res.setHeader('access-control-allow-origin', '*')
          res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
          proxyRes.pipe(res)
        })
        proxyReq.on('error', (err) => {
          console.error(`[${prefix}-proxy]`, err.message)
          res.writeHead(502)
          res.end('Proxy error')
        })
        req.pipe(proxyReq)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'https://api.accsaber.com'

  return {
    plugins: [
      vue(),
      apiProxy(proxyTarget),
      externalProxy('/proxy/beatsaver', 'https://api.beatsaver.com'),
      externalProxy('/proxy/beatleader', 'https://api.beatleader.com'),
      externalProxy('/proxy/scoresaber', 'https://scoresaber.com'),
    ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
    build: {
      target: 'esnext',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
      },
    },
  }
})

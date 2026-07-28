import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig(() => {
  return {
    plugins: [vue(), cloudflare()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    environments: {
      client: {
        build: {
          target: 'esnext',
          rollupOptions: {
            input: {
              main: resolve(__dirname, 'index.html'),
            },
          },
        },
      },
    },
  }
})

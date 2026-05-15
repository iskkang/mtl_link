import { defineConfig }          from 'vite'
import react                     from '@vitejs/plugin-react'
import type { Plugin, UserConfig } from 'vite'
import { resolve }               from 'node:path'
import { createServer }          from 'node:http'
import type { Server }           from 'node:http'

// Local-dev only: runs api/*.ts handlers on a separate HTTP port so Vite's
// transform pipeline never touches /api/* requests.
// In production Vercel routes /api/* to the serverless functions directly.

const API_PORT = 4001

function localApiPlugin(): Plugin {
  let apiServer: Server | null = null

  return {
    name:  'local-api',
    apply: 'serve',   // dev only — skipped during `vite build`

    // Inject proxy so /api/* → localhost:4001 (our API server)
    config(): UserConfig {
      return {
        server: {
          proxy: {
            '/api': {
              target:       `http://127.0.0.1:${API_PORT}`,
              changeOrigin: true,
            },
          },
        },
      }
    },

    configureServer(server) {
      apiServer = createServer(async (req, res) => {
        // /api/tracking?numbers=X  →  funcName = 'tracking'
        const funcName   = (req.url ?? '/').split('?')[0].replace(/^\/api\//, '')
        const modulePath = resolve(process.cwd(), 'api', `${funcName}.ts`)

        try {
          // ssrLoadModule transpiles TypeScript and caches the module.
          // Subsequent calls use the cache (instant). Changes trigger HMR invalidation.
          const mod     = await server.ssrLoadModule(modulePath)
          const handler = mod.default as ((req: unknown, res: unknown) => Promise<void>) | undefined

          if (typeof handler !== 'function') {
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: `api/${funcName}.ts has no default export` }))
            return
          }

          await handler(req, res)
        } catch (err) {
          console.error(`[local-api] ${funcName}:`, err)
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: String(err) }))
          }
        }
      })

      apiServer.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`[local-api] port ${API_PORT} already in use — kill the other process or change API_PORT`)
        } else {
          console.error('[local-api] server error:', err)
        }
      })

      apiServer.listen(API_PORT, '127.0.0.1', () => {
        console.log(`  ➜  [local-api] API server on http://127.0.0.1:${API_PORT}`)
      })
    },

    // Clean up when dev server stops
    closeBundle() {
      apiServer?.close()
    },
  }
}

export default defineConfig({
  plugins: [react(), localApiPlugin()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir:    'dist',
    sourcemap: false,
  },
})

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import admin from './routes/admin.js'
import health from './routes/health.js'
import societies from './routes/societies.js'
import { errorHandler } from './middleware/error-handler.js'
import { initializeDatabase } from './db/migrate.js'
import { closeDatabase } from './db/client.js'

const BANNER = `
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║  ██╗  ██╗███████╗██╗   ██╗███████╗ ██████╗ ██████╗  ██████╗ ███████╗  ║
║  ██║ ██╔╝██╔════╝╚██╗ ██╔╝██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝  ║
║  █████╔╝ █████╗   ╚████╔╝ █████╗  ██║   ██║██████╔╝██║  ███╗█████╗    ║
║  ██╔═██╗ ██╔══╝    ╚██╔╝  ██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝    ║
║  ██║  ██╗███████╗   ██║   ██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗  ║
║  ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝  ║
║                                                                       ║
║                   Multi-Tenant VaultWarden Manager                    ║
║                                                                       ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
`

const app = new Hono()

app.use('*', logger())

app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3001'],
  credentials: true
}))

app.use('*', errorHandler)

app.get('/', (c) => {
  return c.json({
    name: 'Keyforge API',
    version: '0.1.0',
    status: 'running'
  })
})

app.route('/admin', admin)
app.route('/health', health)
app.route('/', societies)

console.log(BANNER)

await initializeDatabase()

const server = serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`🚀 Server running on http://localhost:${info.port}`)
  console.log(`📚 API Reference: http://localhost:${info.port}/`)
  console.log('')
})


process.on('SIGINT', async () => {
  await closeDatabase()
  server.close()
  process.exit(0)
})
process.on('SIGTERM', async () => {
  await closeDatabase()
  server.close((err) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    process.exit(0)
  })
})

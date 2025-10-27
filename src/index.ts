import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import admin from './routes/admin.js'
import health from './routes/health.js'
import organisations from './routes/organisations.js'
import { errorHandler } from './middleware/error-handler.js'
import { jwtAuth, requireAdmin } from './middleware/jwt-auth.js'
import { auditMiddleware } from './middleware/audit-middleware.js'
import { initializeDatabase } from './db/migrate.js'
import { closeDatabase } from './db/client.js'
import { loadRootPublicKey } from './services/key-registry.js'

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

// Audit middleware (logs all authenticated requests)
app.use('*', auditMiddleware)

app.get('/', (c) => {
  return c.json({
    name: 'Keyforge API',
    version: '0.1.0',
    status: 'running'
  })
})

// Protected admin routes (require JWT with isAdmin: true)
app.use('/admin/*', jwtAuth, requireAdmin)
app.route('/admin', admin)

// Health check (public)
app.route('/health', health)

// Organisation routes (require JWT with matching instanceId)
app.use('/organisations/*', jwtAuth)
app.route('/', organisations)

console.log(BANNER)

// Initialize root JWT public key
try {
  loadRootPublicKey()
  console.log('✅ Root JWT public key loaded successfully')
} catch (error) {
  console.error('❌ Failed to load root JWT public key:', error)
  console.error('   Make sure ROOT_JWT_PUBLIC_KEY environment variable is set')
  process.exit(1)
}

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

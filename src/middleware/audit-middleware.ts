import { randomBytes } from 'crypto'
import type { Context, Next } from 'hono'
import { logRequest, categorizeRequest } from '../services/audit-logger.js'

/**
 * Audit Middleware
 * Logs all authenticated requests to the audit log
 * Runs after JWT authentication middleware
 */
export async function auditMiddleware(c: Context, next: Next): Promise<void> {
  const jwt = c.get('jwt')
  const requestId = jwt?.requestId || randomBytes(8).toString('hex')
  c.set('requestId', requestId)

  await next()

  if (jwt) {
    const endpoint = c.req.path
    const method = c.req.method
    const instanceId = jwt.instanceId
    const metadata = jwt.metadata || {}
    const responseStatus = c.res.status
    const eventType = categorizeRequest(endpoint, method)

    logRequest(
      endpoint,
      method,
      instanceId,
      requestId,
      metadata,
      responseStatus,
      eventType
    ).catch((error) => {
      console.error('Audit logging failed:', error)
    })
  }
}

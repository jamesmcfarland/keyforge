import { randomBytes } from 'crypto'
import type { Context, Next } from 'hono'
import { logRequest, categorizeRequest } from '../services/audit-logger.js'

/**
 * Audit Middleware
 * Logs all authenticated requests to the audit log
 * Runs after JWT authentication middleware
 */
export async function auditMiddleware(c: Context, next: Next): Promise<void> {
  // Get JWT payload (if authenticated)
  const jwt = c.get('jwt')
  
  // Generate request ID if not in JWT
  const requestId = jwt?.requestId || randomBytes(8).toString('hex')
  c.set('requestId', requestId)

  // Call next middleware/handler
  await next()

  // Only log if authenticated (has JWT)
  if (jwt) {
    const endpoint = c.req.path
    const method = c.req.method
    const instanceId = jwt.instanceId
    const metadata = jwt.metadata || {}
    const responseStatus = c.res.status
    const eventType = categorizeRequest(endpoint, method)

    // Log asynchronously (don't await - let it run in background)
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

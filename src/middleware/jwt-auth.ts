import type { Context, Next } from 'hono'
import { verifyJWT, decodeJWT } from '../services/jwt-service.js'
import { getPublicKeyForVerification } from '../services/key-registry.js'
import { logAuthFailure } from '../services/audit-logger.js'

/**
 * JWT Authentication Middleware
 * Verifies incoming JWT tokens and attaches payload to context
 */
export async function jwtAuth(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization')

  if (!authHeader) {
    await logAuthFailure(c.req.path, c.req.method, 'No authorization header')
    return c.json({ error: 'No authorization token' }, 401)
  }

  // Extract Bearer token
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    await logAuthFailure(c.req.path, c.req.method, 'Invalid authorization header format')
    return c.json({ error: 'Invalid authorization header format' }, 401)
  }

  const token = parts[1]

  // Decode to get sub and instanceId (without verification)
  const decoded = decodeJWT(token)
  if (!decoded) {
    await logAuthFailure(c.req.path, c.req.method, 'Malformed JWT token')
    return c.json({ error: 'Invalid token' }, 401)
  }

  // Get the public key for verification
  const publicKey = await getPublicKeyForVerification(decoded.sub, decoded.instanceId)
  if (!publicKey) {
    await logAuthFailure(c.req.path, c.req.method, `Unknown subject: ${decoded.sub}`)
    return c.json({ error: 'Unknown instance or invalid token' }, 401)
  }

  // Verify JWT signature and expiration
  const payload = verifyJWT(token, publicKey)
  if (!payload) {
    await logAuthFailure(c.req.path, c.req.method, 'JWT verification failed')
    return c.json({ error: 'Invalid token signature or expired' }, 401)
  }

  // Attach JWT payload to context
  c.set('jwt', payload)
  
  // Log JWT data (as specified in requirements)
  console.log('JWT Data:', {
    sub: payload.sub,
    instanceId: payload.instanceId,
    requestId: payload.requestId,
    metadata: payload.metadata,
    isAdmin: payload.isAdmin,
    path: c.req.path,
    method: c.req.method
  })

  await next()
}

/**
 * Require admin permissions
 * Must be used after jwtAuth middleware
 */
export async function requireAdmin(c: Context, next: Next): Promise<Response | void> {
  const jwt = c.get('jwt')

  if (!jwt) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  if (!jwt.isAdmin) {
    await logAuthFailure(c.req.path, c.req.method, 'Admin access required')
    return c.json({ error: 'Admin access required' }, 403)
  }

  await next()
}

/**
 * Require matching instance ID
 * Verifies that the JWT instanceId matches the requested resource
 */
export function requireInstance(instanceIdParam: string = 'id') {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const jwt = c.get('jwt')

    if (!jwt) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    // Admin tokens can access any instance
    if (jwt.isAdmin) {
      await next()
      return
    }

    // Extract instance ID from request
    const requestedInstanceId = c.req.param(instanceIdParam)
    
    if (requestedInstanceId && jwt.instanceId !== requestedInstanceId) {
      await logAuthFailure(
        c.req.path,
        c.req.method,
        `Instance mismatch: JWT=${jwt.instanceId}, Requested=${requestedInstanceId}`
      )
      return c.json({ error: 'Access denied to this instance' }, 403)
    }

    await next()
  }
}

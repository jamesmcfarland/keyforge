import type { Context, Next } from 'hono'
import { timingSafeEqual } from 'crypto'
import { logAuthFailure } from '../services/audit-logger.js'

/**
 * API Key Authentication Middleware for Admin Routes
 * Validates admin API key from Authorization header
 */
export async function apiKeyAuth(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization')

  if (!authHeader) {
    await logAuthFailure(c.req.path, c.req.method, 'No authorization header')
    return c.json({ error: 'No authorization token provided' }, 401)
  }

  // Extract Bearer token
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    await logAuthFailure(c.req.path, c.req.method, 'Invalid authorization header format')
    return c.json({ error: 'Invalid authorization header format. Use: Bearer <API_KEY>' }, 401)
  }

  const providedKey = parts[1]

  // Get the admin API key from environment
  const adminApiKey = process.env.ADMIN_API_KEY

  if (!adminApiKey) {
    console.error('ADMIN_API_KEY environment variable not set')
    return c.json({ error: 'Server configuration error' }, 500)
  }

  // Validate API key using constant-time comparison to prevent timing attacks
  if (!isValidApiKey(providedKey, adminApiKey)) {
    await logAuthFailure(c.req.path, c.req.method, 'Invalid API key')
    return c.json({ error: 'Invalid API key' }, 401)
  }

  // Set admin flag in context for audit logging
  c.set('isAdmin', true)

  await next()
}

/**
 * Constant-time comparison of API keys to prevent timing attacks
 * @param providedKey The API key from the request
 * @param validKey The valid API key from environment
 * @returns true if keys match, false otherwise
 */
function isValidApiKey(providedKey: string, validKey: string): boolean {
  try {
    // Ensure both keys are the same length to use timingSafeEqual
    if (providedKey.length !== validKey.length) {
      return false
    }

    const providedBuffer = Buffer.from(providedKey, 'utf8')
    const validBuffer = Buffer.from(validKey, 'utf8')

    return timingSafeEqual(providedBuffer, validBuffer)
  } catch (error) {
    console.error('Error comparing API keys:', error)
    return false
  }
}

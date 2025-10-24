import type { Context, Next } from 'hono'

export async function errorHandler(c: Context, next: Next): Promise<Response | void> {
  try {
    await next()
  } catch (error) {
    console.error('Unhandled error:', error)
    
    const message = error instanceof Error ? error.message : 'Internal server error'
    
    return c.json({
      error: message,
      timestamp: Date.now()
    }, 500)
  }
}

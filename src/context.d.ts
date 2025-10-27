import type { JWTPayload } from './types.js'

declare module 'hono' {
  interface ContextVariableMap {
    jwt?: JWTPayload
    requestId: string
  }
}

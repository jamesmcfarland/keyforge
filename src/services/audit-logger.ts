import { randomBytes } from 'crypto'
import { db } from '../db/client.js'
import { auditLogs } from '../db/schema.js'
import type { AuditEventType } from '../types.js'

/**
 * Log an authenticated request to the audit log
 * This runs asynchronously to avoid blocking the response
 * 
 * @param endpoint Request endpoint path
 * @param method HTTP method
 * @param instanceId Instance ID from JWT
 * @param requestId Request ID from JWT or generated
 * @param metadata Metadata object from JWT
 * @param responseStatus HTTP response status code
 * @param eventType Type of event for categorization
 */
export async function logRequest(
  endpoint: string,
  method: string,
  instanceId: string,
  requestId: string,
  metadata: Record<string, any>,
  responseStatus: number,
  eventType: AuditEventType
): Promise<void> {
  try {
    const id = `audit-${randomBytes(8).toString('hex')}`
    
    await db.insert(auditLogs).values({
      id,
      timestamp: new Date(),
      endpoint,
      method,
      instance_id: instanceId,
      request_id: requestId,
      metadata: JSON.stringify(metadata),
      response_status: responseStatus.toString(),
      event_type: eventType,
      created_at: new Date()
    })
  } catch (error) {
    // Don't throw - audit logging should never crash the app
    console.error('Failed to write audit log:', error)
  }
}

/**
 * Categorize a request based on endpoint and method
 * Used to auto-assign event types
 * 
 * @param path Request path
 * @param method HTTP method
 * @returns Event type
 */
export function categorizeRequest(path: string, method: string): AuditEventType {
  // Admin operations
  if (path.startsWith('/admin/instances')) {
    if (method === 'POST') return 'admin_operation'
    if (method === 'DELETE') return 'admin_operation'
    if (method === 'GET') return 'instance_access'
  }

  // Data modifications
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    return 'data_modification'
  }

  // Key rotation
  if (path.includes('/keys') || path.includes('/rotate')) {
    return 'key_rotation'
  }

  // Default to instance access
  return 'instance_access'
}

/**
 * Log authentication failure
 * Special case for failed auth attempts
 * 
 * @param endpoint Request endpoint
 * @param method HTTP method
 * @param reason Failure reason
 */
export async function logAuthFailure(
  endpoint: string,
  method: string,
  reason: string
): Promise<void> {
  try {
    const id = `audit-${randomBytes(8).toString('hex')}`
    
    await db.insert(auditLogs).values({
      id,
      timestamp: new Date(),
      endpoint,
      method,
      instance_id: 'unknown',
      request_id: randomBytes(8).toString('hex'),
      metadata: JSON.stringify({ reason }),
      response_status: '401',
      event_type: 'auth_failure',
      created_at: new Date()
    })
  } catch (error) {
    console.error('Failed to write auth failure log:', error)
  }
}

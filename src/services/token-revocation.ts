import { db } from '../db/client.js'
import { revokedTokens } from '../db/schema.js'
import { eq, and, lt } from 'drizzle-orm'

/**
 * Check if a token has been revoked
 * @param jti Token ID (JWT ID)
 * @param instanceId Instance ID
 * @returns true if token is revoked, false otherwise
 */
export async function isTokenRevoked(jti: string, instanceId: string): Promise<boolean> {
  try {
    const revoked = await db
      .select()
      .from(revokedTokens)
      .where(and(eq(revokedTokens.jti, jti), eq(revokedTokens.instance_id, instanceId)))
      .limit(1)

    return revoked.length > 0
  } catch (error) {
    console.error('Error checking token revocation:', error)
    return true // Fail closed - treat as revoked on error
  }
}

/**
 * Revoke a token
 * @param jti Token ID (JWT ID)
 * @param instanceId Instance ID
 * @param expiresAt Token expiration time
 */
export async function revokeToken(jti: string, instanceId: string, expiresAt: Date): Promise<void> {
  try {
    await db.insert(revokedTokens).values({
      jti,
      instance_id: instanceId,
      expires_at: expiresAt
    }).onConflictDoNothing()
  } catch (error) {
    console.error('Error revoking token:', error)
    throw new Error('Failed to revoke token')
  }
}

/**
 * Clean up expired revoked tokens from the database
 * Removes entries where the token has expired to keep the table size manageable
 */
export async function cleanupExpiredRevokedTokens(): Promise<number> {
  try {
    const now = new Date()
    await db
      .delete(revokedTokens)
      .where(lt(revokedTokens.expires_at, now))
    
    return 0
  } catch (error) {
    console.error('Error cleaning up expired revoked tokens:', error)
    return 0
  }
}

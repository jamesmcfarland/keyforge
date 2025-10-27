import { randomBytes } from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { keyPairs } from '../db/schema.js'

let rootPublicKey: string | null = null

/**
 * Initialize and load root public key from environment
 * Must be called on startup
 */
export function loadRootPublicKey(): string {
  const key = process.env.ROOT_JWT_PUBLIC_KEY
  
  if (!key) {
    throw new Error('ROOT_JWT_PUBLIC_KEY environment variable not set')
  }

  // Decode from base64 if encoded
  let decoded: string
  try {
    decoded = Buffer.from(key, 'base64').toString('utf8')
    // Verify it's a PEM format key
    if (!decoded.includes('BEGIN PUBLIC KEY')) {
      throw new Error('Invalid PEM format')
    }
  } catch {
    // If not base64, assume it's already PEM format
    decoded = key
  }

  rootPublicKey = decoded
  return decoded
}

/**
 * Get the root public key
 * @returns Root public key in PEM format
 */
export function getRootPublicKey(): string {
  if (!rootPublicKey) {
    throw new Error('Root public key not loaded. Call loadRootPublicKey() first.')
  }
  return rootPublicKey
}

/**
 * Store an instance's public key in the database
 * @param instanceId Instance ID
 * @param publicKey Public key in PEM format
 */
export async function storeInstanceKey(instanceId: string, publicKey: string): Promise<void> {
  const id = `keypair-${randomBytes(8).toString('hex')}`
  
  await db.insert(keyPairs).values({
    id,
    instance_id: instanceId,
    public_key: publicKey,
    created_at: new Date(),
    revoked_at: null
  })
}

/**
 * Get an instance's public key from the database
 * @param instanceId Instance ID
 * @returns Public key in PEM format, or null if not found
 */
export async function getInstancePublicKey(instanceId: string): Promise<string | null> {
  const results = await db
    .select()
    .from(keyPairs)
    .where(eq(keyPairs.instance_id, instanceId))
    .limit(1)

  if (results.length === 0) {
    return null
  }

  const keyPair = results[0]
  
  // Check if revoked
  if (keyPair.revoked_at) {
    return null
  }

  return keyPair.public_key
}

/**
 * Revoke a key pair
 * @param instanceId Instance ID
 */
export async function revokeInstanceKey(instanceId: string): Promise<void> {
  await db
    .update(keyPairs)
    .set({ revoked_at: new Date() })
    .where(eq(keyPairs.instance_id, instanceId))
}

/**
 * Get public key for verification (root or instance)
 * @param sub Subject from JWT (either "root" or instance ID)
 * @param instanceId Instance ID from JWT payload
 * @returns Public key in PEM format, or null if not found
 */
export async function getPublicKeyForVerification(
  sub: string,
  instanceId: string
): Promise<string | null> {
  if (sub === 'root') {
    return getRootPublicKey()
  }
  
  // For instance tokens, verify the sub matches the instanceId
  if (sub !== instanceId) {
    console.warn(`JWT sub (${sub}) does not match instanceId (${instanceId})`)
    return null
  }
  
  return getInstancePublicKey(instanceId)
}

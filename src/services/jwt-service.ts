import { createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, verify } from 'crypto'
import type { JWTPayload } from '../types.js'

/**
 * Generate a unique JWT ID (jti) for token revocation support
 * @returns Unique token ID
 */
export function generateJTI(): string {
  return randomBytes(16).toString('hex')
}

/**
 * Generate an ECC P-256 key pair for JWT signing
 * @returns Object with privateKey and publicKey in PEM format
 */
export function generateECCKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1', // P-256
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  })

  return {
    privateKey,
    publicKey
  }
}

/**
 * Sign a JWT payload with a private key
 * Used for testing purposes - clients will sign their own JWTs
 * @param payload JWT payload
 * @param privateKeyPEM Private key in PEM format
 * @returns Signed JWT token
 */
export function signJWT(payload: JWTPayload, privateKeyPEM: string): string {
  const header = {
    alg: 'ES256',
    typ: 'JWT'
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const message = `${encodedHeader}.${encodedPayload}`

  const privateKey = createPrivateKey(privateKeyPEM)
  const signature = sign('sha256', Buffer.from(message), privateKey)
  const encodedSignature = base64UrlEncode(signature)

  return `${message}.${encodedSignature}`
}

/**
 * Verify a JWT token with a public key
 * @param token JWT token to verify
 * @param publicKeyPEM Public key in PEM format
 * @returns Decoded payload if valid, null if invalid
 */
export function verifyJWT(token: string, publicKeyPEM: string): JWTPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts
    const message = `${encodedHeader}.${encodedPayload}`
    
    // Verify signature
    const publicKey = createPublicKey(publicKeyPEM)
    const signature = base64UrlDecode(encodedSignature)
    const isValid = verify('sha256', Buffer.from(message), publicKey, signature)

    if (!isValid) {
      return null
    }

    // Decode payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as JWTPayload

    // Validate all required claims exist
    if (!payload.sub || !payload.iat || !payload.exp || !payload.instanceId || !payload.jti) {
      return null
    }

    const now = Math.floor(Date.now() / 1000)
    
    // Check that token was not issued in the future (RFC 7519 Section 4.1.6)
    // Allow 30 seconds of clock skew for system time differences
    const CLOCK_SKEW_SECONDS = 30
    if (payload.iat > (now + CLOCK_SKEW_SECONDS)) {
      return null
    }

    // Check expiration
    if (payload.exp < now) {
      return null
    }

    // Check that token expiration is after issuance (logical consistency)
    if (payload.iat > payload.exp) {
      return null
    }

    return payload
  } catch (error) {
    console.error('JWT verification error:', error)
    return null
   }
}

/**
 * Verify a JWT token with a public key and check revocation status
 * This is the full async verification that includes revocation checks
 * @param token JWT token to verify
 * @param publicKeyPEM Public key in PEM format
 * @param instanceId Instance ID for revocation check
 * @returns Decoded payload if valid, null if invalid
 */
export async function verifyJWTWithRevocation(
  token: string,
  publicKeyPEM: string,
  instanceId: string
): Promise<JWTPayload | null> {
  // First do sync verification
  const payload = verifyJWT(token, publicKeyPEM)
  if (!payload) {
    return null
  }

  // Then check revocation (async)
  try {
    const { isTokenRevoked } = await import('./token-revocation.js')
    const revoked = await isTokenRevoked(payload.jti, instanceId)
    if (revoked) {
      return null
    }
  } catch (error) {
    console.error('Error checking token revocation:', error)
    return null
  }

  return payload
}

/**
 * Decode JWT without verification (unsafe - for inspection only)
 * @param token JWT token
 * @returns Decoded payload or null
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const [, encodedPayload] = parts
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as JWTPayload
    return payload
  } catch (error) {
    return null
  }
}

/**
 * Base64 URL encode
 */
function base64UrlEncode(input: string | Buffer): string {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Base64 URL decode
 * Includes validation to prevent DoS attacks from malformed input
 */
function base64UrlDecode(input: string): Buffer {
  // Prevent DoS: limit input size to 10MB (JWT tokens should be much smaller)
  const MAX_BASE64_SIZE = 10 * 1024 * 1024
  if (input.length > MAX_BASE64_SIZE) {
    throw new Error('Base64 input exceeds maximum allowed size')
  }

  let base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  
  // Add padding - but limit iterations to prevent infinite loops
  let iterations = 0
  const MAX_PADDING_ITERATIONS = 10
  while (base64.length % 4 && iterations < MAX_PADDING_ITERATIONS) {
    base64 += '='
    iterations++
  }

  // If we hit max iterations without proper padding, reject
  if (base64.length % 4 !== 0) {
    throw new Error('Invalid base64 padding')
  }

  return Buffer.from(base64, 'base64')
}

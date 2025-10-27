import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'crypto'
import type { JWTPayload } from '../types.js'

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

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) {
      return null
    }

    return payload
  } catch (error) {
    console.error('JWT verification error:', error)
    return null
  }
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
 */
function base64UrlDecode(input: string): Buffer {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return Buffer.from(base64, 'base64')
}

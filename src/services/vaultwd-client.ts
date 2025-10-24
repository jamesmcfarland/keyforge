import { webcrypto } from 'node:crypto'
import type { HealthStatus } from '../types.js'

export async function checkHealth(vaultwd_url: string): Promise<{ status: HealthStatus; message?: string }> {
  const maxRetries = 3
  const retryDelay = 2000

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${vaultwd_url}/api/alive`, {
        method: 'GET',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        return { status: 'healthy' }
      }

      return {
        status: 'unhealthy',
        message: `VaultWarden returned status ${response.status}`
      }
    } catch (error) {
      if (attempt === maxRetries) {
        return {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Connection failed'
        }
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }

  return {
    status: 'unhealthy',
    message: 'Max retries exceeded'
  }
}

async function generateMasterPasswordHash(email: string, password: string): Promise<string> {
  const emailLower = email.toLowerCase()
  const passwordBuffer = new TextEncoder().encode(password)
  const saltBuffer = new TextEncoder().encode(emailLower)
  
  const keyMaterial = await webcrypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  )
  
  const derivedBits = await webcrypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  )
  
  const hashArray = Array.from(new Uint8Array(derivedBits))
  const hashBase64 = Buffer.from(hashArray).toString('base64')
  
  return hashBase64
}

export async function registerUser(
  vaultwd_url: string,
  email: string,
  name: string
): Promise<string> {
  const masterPassword = webcrypto.randomUUID()
  const masterPasswordHash = await generateMasterPasswordHash(email, masterPassword)
  
  try {
    const response = await fetch(`${vaultwd_url}/identity/accounts/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        name,
        masterPasswordHash,
        masterPasswordHint: '',
        key: '',
        keys: {
          encryptedPrivateKey: '',
          publicKey: ''
        },
        kdf: 0,
        kdfIterations: 100000
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Registration failed with status ${response.status}: ${errorText}`)
    }

    return masterPassword
  } catch (error) {
    throw new Error(`Failed to register user: ${error}`)
  }
}

export async function authenticateUser(
  vaultwd_url: string,
  email: string,
  masterPassword: string
): Promise<string> {
  const masterPasswordHash = await generateMasterPasswordHash(email, masterPassword)
  
  try {
    const params = new URLSearchParams({
      grant_type: 'password',
      username: email,
      password: masterPasswordHash,
      scope: 'api offline_access',
      client_id: 'web',
      deviceType: '10',
      deviceName: 'keyforge',
      deviceIdentifier: webcrypto.randomUUID()
    })

    const response = await fetch(`${vaultwd_url}/identity/connect/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Authentication failed with status ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    return data.access_token
  } catch (error) {
    throw new Error(`Failed to authenticate user: ${error}`)
  }
}

export async function createOrganization(
  vaultwd_url: string,
  userToken: string,
  name: string
): Promise<string> {
  try {
    const response = await fetch(`${vaultwd_url}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        name,
        billingEmail: 'noreply@example.com',
        planType: 0,
        key: '',
        keys: {
          encryptedPrivateKey: '',
          publicKey: ''
        },
        collectionName: 'default'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Create organization failed with status ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    return data.id
  } catch (error) {
    throw new Error(`Failed to create organization: ${error}`)
  }
}

export async function createCipher(
  vaultwd_url: string,
  userToken: string,
  organizationId: string,
  name: string,
  password: string,
  username?: string,
  totp?: string,
  uris?: string[],
  notes?: string
): Promise<string> {
  try {
    const response = await fetch(`${vaultwd_url}/api/ciphers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        type: 1,
        organizationId,
        name,
        login: {
          username: username || null,
          password,
          totp: totp || null,
          uris: uris ? uris.map(uri => ({ uri, match: null })) : null
        },
        notes: notes || null,
        favorite: false,
        folderId: null,
        collectionIds: []
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Create cipher failed with status ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    return data.id
  } catch (error) {
    throw new Error(`Failed to create cipher: ${error}`)
  }
}

export async function getCiphers(
  vaultwd_url: string,
  userToken: string,
  organizationId: string
): Promise<Array<{ id: string; name: string; created_at: number }>> {
  try {
    const response = await fetch(`${vaultwd_url}/api/ciphers/organization-details?organizationId=${organizationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Fetch ciphers failed with status ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    const ciphers = data.data || []
    
    return ciphers.map((cipher: any) => ({
      id: cipher.id,
      name: cipher.name,
      created_at: cipher.creationDate ? new Date(cipher.creationDate).getTime() : Date.now()
    }))
  } catch (error) {
    throw new Error(`Failed to fetch ciphers: ${error}`)
  }
}

export async function getCipher(
  vaultwd_url: string,
  userToken: string,
  cipherId: string
): Promise<{ id: string; name: string; username?: string; password: string; totp?: string; uris?: string[]; notes?: string; created_at: number }> {
  try {
    const response = await fetch(`${vaultwd_url}/api/ciphers/${cipherId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Fetch cipher failed with status ${response.status}: ${errorText}`)
    }

    const cipher = await response.json()
    
    return {
      id: cipher.id,
      name: cipher.name,
      username: cipher.login?.username || undefined,
      password: cipher.login?.password || '',
      totp: cipher.login?.totp || undefined,
      uris: cipher.login?.uris ? cipher.login.uris.map((u: any) => u.uri) : undefined,
      notes: cipher.notes || undefined,
      created_at: cipher.creationDate ? new Date(cipher.creationDate).getTime() : Date.now()
    }
  } catch (error) {
    throw new Error(`Failed to fetch cipher: ${error}`)
  }
}

export async function updateCipher(
  vaultwd_url: string,
  userToken: string,
  cipherId: string,
  organizationId: string,
  name: string,
  password: string,
  username?: string,
  totp?: string,
  uris?: string[],
  notes?: string
): Promise<void> {
  try {
    const response = await fetch(`${vaultwd_url}/api/ciphers/${cipherId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        type: 1,
        organizationId,
        name,
        login: {
          username: username || null,
          password,
          totp: totp || null,
          uris: uris ? uris.map(uri => ({ uri, match: null })) : null
        },
        notes: notes || null,
        favorite: false,
        folderId: null,
        collectionIds: []
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Update cipher failed with status ${response.status}: ${errorText}`)
    }
  } catch (error) {
    throw new Error(`Failed to update cipher: ${error}`)
  }
}

export async function deleteCipher(
  vaultwd_url: string,
  userToken: string,
  cipherId: string
): Promise<void> {
  try {
    const response = await fetch(`${vaultwd_url}/api/ciphers/${cipherId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Delete cipher failed with status ${response.status}: ${errorText}`)
    }
  } catch (error) {
    throw new Error(`Failed to delete cipher: ${error}`)
  }
}

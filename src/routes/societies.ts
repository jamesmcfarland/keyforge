import { Hono } from 'hono'
import { randomBytes } from 'crypto'
import type { CreateSocietyRequest, CreateSocietyResponse, CreatePasswordRequest, UpdatePasswordRequest, CreatePasswordResponse, PasswordListResponse } from '../types.js'
import type { Society, Password } from '../types.js'
import * as registry from '../services/registry.js'
import * as vaultwd from '../services/vaultwd-client.js'

const societies = new Hono()

societies.post('/unions/:union_id/societies', async (c) => {
  try {
    const unionId = c.req.param('union_id')
    const union = await registry.getUnion(unionId)

    if (!union) {
      return c.json({ error: 'Union not found' }, 404)
    }

    if (union.status !== 'ready') {
      return c.json({ error: `Union status is ${union.status}` }, 503)
    }

    const body = await c.req.json<CreateSocietyRequest>()
    if (!body.name || body.name.trim().length === 0) {
      return c.json({ error: 'Society name is required' }, 400)
    }

    const societyId = `society-${randomBytes(8).toString('hex')}`
    const userEmail = `${societyId}@keyforge.local`

    const society: Society = {
      id: societyId,
      name: body.name,
      union_id: unionId,
      vaultwd_user_email: userEmail,
      status: 'pending',
      created_at: Date.now()
    }

    await registry.addSociety(society)

    try {
      const masterPassword = await vaultwd.registerUser(union.vaultwd_url, userEmail, body.name)
      const userToken = await vaultwd.authenticateUser(union.vaultwd_url, userEmail, masterPassword)
      const orgId = await vaultwd.createOrganization(union.vaultwd_url, userToken, body.name)
      
      await registry.updateSocietyOrgId(societyId, orgId)
      await registry.updateSocietyUserToken(societyId, userToken)
      await registry.updateSocietyStatus(societyId, 'created')

      const response: CreateSocietyResponse = {
        society_id: societyId,
        union_id: unionId,
        vaultwd_org_id: orgId,
        status: 'created'
      }

      return c.json(response, 201)
    } catch (error) {
      await registry.updateSocietyStatus(societyId, 'failed')
      throw error
    }
  } catch (error) {
    console.error('Error creating society:', error)
    return c.json({ error: 'Failed to create society' }, 500)
  }
})

societies.get('/unions/:union_id/societies/:society_id', async (c) => {
  const societyId = c.req.param('society_id')
  const unionId = c.req.param('union_id')
  const society = await registry.getSociety(societyId)

  if (!society || society.union_id !== unionId) {
    return c.json({ error: 'Society not found' }, 404)
  }

  return c.json(society)
})

societies.post('/unions/:union_id/societies/:society_id/passwords', async (c) => {
  try {
    const unionId = c.req.param('union_id')
    const societyId = c.req.param('society_id')

    const union = await registry.getUnion(unionId)
    const society = await registry.getSociety(societyId)

    if (!union) {
      return c.json({ error: 'Union not found' }, 404)
    }

    if (!society || society.union_id !== unionId) {
      return c.json({ error: 'Society not found' }, 404)
    }

    if (!society.vaultwd_org_id || !society.vaultwd_user_token) {
      return c.json({ error: 'Society not properly initialized' }, 503)
    }

    const body = await c.req.json<CreatePasswordRequest>()
    if (!body.name || body.name.trim().length === 0) {
      return c.json({ error: 'Password name is required' }, 400)
    }
    if (!body.value || body.value.length === 0) {
      return c.json({ error: 'Password value is required' }, 400)
    }

    const passwordId = `pwd-${randomBytes(8).toString('hex')}`

    try {
      const cipherId = await vaultwd.createCipher(union.vaultwd_url, society.vaultwd_user_token, society.vaultwd_org_id, body.name, body.value)
      
      const password: Password = {
        id: passwordId,
        society_id: societyId,
        vaultwd_cipher_id: cipherId,
        created_at: Date.now()
      }

      await registry.addPassword(password)

      const response: CreatePasswordResponse = {
        password_id: passwordId,
        society_id: societyId,
        name: body.name,
        created_at: password.created_at
      }

      return c.json(response, 201)
    } catch (error) {
      console.error('Error creating cipher:', error)
      throw error
    }
  } catch (error) {
    console.error('Error creating password:', error)
    return c.json({ error: 'Failed to create password' }, 500)
  }
})

societies.get('/unions/:union_id/societies/:society_id/passwords', async (c) => {
  try {
    const unionId = c.req.param('union_id')
    const societyId = c.req.param('society_id')

    const union = await registry.getUnion(unionId)
    const society = await registry.getSociety(societyId)

    if (!union) {
      return c.json({ error: 'Union not found' }, 404)
    }

    if (!society || society.union_id !== unionId) {
      return c.json({ error: 'Society not found' }, 404)
    }

    if (!society.vaultwd_org_id || !society.vaultwd_user_token) {
      return c.json({ error: 'Society not properly initialized' }, 503)
    }

    const passwords = await registry.getPasswordsBySociety(societyId)
    const ciphers = await vaultwd.getCiphers(union.vaultwd_url, society.vaultwd_user_token, society.vaultwd_org_id)

    const cipherMap = new Map(ciphers.map(cipher => [cipher.id, cipher]))
    
    const passwordsWithData = passwords.map(pwd => ({
      id: pwd.id,
      society_id: pwd.society_id,
      name: cipherMap.get(pwd.vaultwd_cipher_id)?.name || 'Unknown',
      created_at: pwd.created_at
    }))

    const response: PasswordListResponse = {
      society_id: societyId,
      passwords: passwordsWithData
    }

    return c.json(response)
  } catch (error) {
    console.error('Error fetching passwords:', error)
    return c.json({ error: 'Failed to fetch passwords' }, 500)
  }
})

societies.get('/unions/:union_id/societies/:society_id/passwords/:password_id', async (c) => {
  const unionId = c.req.param('union_id')
  const societyId = c.req.param('society_id')
  const passwordId = c.req.param('password_id')

  const union = await registry.getUnion(unionId)
  const society = await registry.getSociety(societyId)
  const password = await registry.getPassword(passwordId)

  if (!union) {
    return c.json({ error: 'Union not found' }, 404)
  }

  if (!society || society.union_id !== unionId) {
    return c.json({ error: 'Society not found' }, 404)
  }

  if (!password || password.society_id !== societyId) {
    return c.json({ error: 'Password not found' }, 404)
  }

  if (!society.vaultwd_user_token) {
    return c.json({ error: 'Society not properly initialized' }, 503)
  }

  try {
    const cipher = await vaultwd.getCipher(union.vaultwd_url, society.vaultwd_user_token, password.vaultwd_cipher_id)
    
    return c.json({
      id: password.id,
      society_id: password.society_id,
      name: cipher.name,
      value: cipher.password,
      created_at: password.created_at
    })
  } catch (error) {
    console.error('Error fetching cipher:', error)
    return c.json({ error: 'Failed to fetch password' }, 500)
  }
})

societies.delete('/unions/:union_id/societies/:society_id/passwords/:password_id', async (c) => {
  const unionId = c.req.param('union_id')
  const societyId = c.req.param('society_id')
  const passwordId = c.req.param('password_id')

  const union = await registry.getUnion(unionId)
  const society = await registry.getSociety(societyId)
  const password = await registry.getPassword(passwordId)

  if (!union) {
    return c.json({ error: 'Union not found' }, 404)
  }

  if (!society || society.union_id !== unionId) {
    return c.json({ error: 'Society not found' }, 404)
  }

  if (!password || password.society_id !== societyId) {
    return c.json({ error: 'Password not found' }, 404)
  }

  if (!society.vaultwd_user_token) {
    return c.json({ error: 'Society not properly initialized' }, 503)
  }

  try {
    await vaultwd.deleteCipher(union.vaultwd_url, society.vaultwd_user_token, password.vaultwd_cipher_id)
    await registry.deletePassword(passwordId)
    return c.json({ message: 'Password deleted successfully' })
  } catch (error) {
    console.error('Error deleting cipher:', error)
    return c.json({ error: 'Failed to delete password' }, 500)
  }
})

societies.put('/unions/:union_id/societies/:society_id/passwords/:password_id', async (c) => {
  try {
    const unionId = c.req.param('union_id')
    const societyId = c.req.param('society_id')
    const passwordId = c.req.param('password_id')

    const union = await registry.getUnion(unionId)
    const society = await registry.getSociety(societyId)
    const password = await registry.getPassword(passwordId)

    if (!union) {
      return c.json({ error: 'Union not found' }, 404)
    }

    if (!society || society.union_id !== unionId) {
      return c.json({ error: 'Society not found' }, 404)
    }

    if (!password || password.society_id !== societyId) {
      return c.json({ error: 'Password not found' }, 404)
    }

    if (!society.vaultwd_org_id || !society.vaultwd_user_token) {
      return c.json({ error: 'Society not properly initialized' }, 503)
    }

    const body = await c.req.json<UpdatePasswordRequest>()
    
    if (!body.name && !body.value) {
      return c.json({ error: 'At least one of name or value is required' }, 400)
    }

    const cipher = await vaultwd.getCipher(union.vaultwd_url, society.vaultwd_user_token, password.vaultwd_cipher_id)
    
    const newName = body.name !== undefined ? body.name : cipher.name
    const newValue = body.value !== undefined ? body.value : cipher.password

    await vaultwd.updateCipher(
      union.vaultwd_url,
      society.vaultwd_user_token,
      password.vaultwd_cipher_id,
      society.vaultwd_org_id,
      newName,
      newValue
    )

    return c.json({
      id: password.id,
      society_id: password.society_id,
      name: newName,
      value: newValue,
      created_at: password.created_at
    })
  } catch (error) {
    console.error('Error updating password:', error)
    return c.json({ error: 'Failed to update password' }, 500)
  }
})

export default societies

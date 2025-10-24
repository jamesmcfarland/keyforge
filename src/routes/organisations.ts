import { Hono } from 'hono'
import { randomBytes } from 'crypto'
import type { CreateOrganisationRequest, CreateOrganisationResponse, CreatePasswordRequest, UpdatePasswordRequest, CreatePasswordResponse, PasswordListResponse } from '../types.js'
import type { Organisation, Password } from '../types.js'
import * as registry from '../services/registry.js'
import * as vaultwd from '../services/vaultwd-client.js'

const organisations = new Hono()

organisations.post('/instances/:instance_id/organisations', async (c) => {
  try {
    const instanceId = c.req.param('instance_id')
    const instance = await registry.getInstance(instanceId)

    if (!instance) {
      return c.json({ error: 'Instance not found' }, 404)
    }

    if (instance.status !== 'ready') {
      return c.json({ error: `Instance status is ${instance.status}` }, 503)
    }

    const body = await c.req.json<CreateOrganisationRequest>()
    if (!body.name || body.name.trim().length === 0) {
      return c.json({ error: 'Organisation name is required' }, 400)
    }

    const organisationId = `organisation-${randomBytes(8).toString('hex')}`
    const userEmail = `${organisationId}@keyforge.local`

    const organisation: Organisation = {
      id: organisationId,
      name: body.name,
      instance_id: instanceId,
      vaultwd_user_email: userEmail,
      status: 'pending',
      created_at: Date.now()
    }

    await registry.addOrganisation(organisation)

    try {
      const masterPassword = await vaultwd.registerUser(instance.vaultwd_url, userEmail, body.name)
      const userToken = await vaultwd.authenticateUser(instance.vaultwd_url, userEmail, masterPassword)
      const orgId = await vaultwd.createOrganization(instance.vaultwd_url, userToken, body.name)
      
      await registry.updateOrganisationOrgId(organisationId, orgId)
      await registry.updateOrganisationUserToken(organisationId, userToken)
      await registry.updateOrganisationStatus(organisationId, 'created')

      const response: CreateOrganisationResponse = {
        organisation_id: organisationId,
        instance_id: instanceId,
        vaultwd_org_id: orgId,
        status: 'created'
      }

      return c.json(response, 201)
    } catch (error) {
      await registry.updateOrganisationStatus(organisationId, 'failed')
      throw error
    }
  } catch (error) {
    console.error('Error creating organisation:', error)
    return c.json({ error: 'Failed to create organisation' }, 500)
  }
})

organisations.get('/instances/:instance_id/organisations', async (c) => {
  const instanceId = c.req.param('instance_id')
  const instance = await registry.getInstance(instanceId)

  if (!instance) {
    return c.json({ error: 'Instance not found' }, 404)
  }

  try {
    const organisations = await registry.getOrganisationsByInstance(instanceId)
    return c.json({ organisations })
  } catch (error) {
    console.error('Error fetching organisations:', error)
    return c.json({ error: 'Failed to fetch organisations' }, 500)
  }
})

organisations.get('/instances/:instance_id/organisations/:organisation_id', async (c) => {
   const organisationId = c.req.param('organisation_id')
   const instanceId = c.req.param('instance_id')
   const organisation = await registry.getOrganisation(organisationId)

   if (!organisation || organisation.instance_id !== instanceId) {
     return c.json({ error: 'Organisation not found' }, 404)
   }

   return c.json(organisation)
})

organisations.post('/instances/:instance_id/organisations/:organisation_id/passwords', async (c) => {
  try {
    const instanceId = c.req.param('instance_id')
    const organisationId = c.req.param('organisation_id')

    const instance = await registry.getInstance(instanceId)
    const organisation = await registry.getOrganisation(organisationId)

    if (!instance) {
      return c.json({ error: 'Instance not found' }, 404)
    }

    if (!organisation || organisation.instance_id !== instanceId) {
      return c.json({ error: 'Organisation not found' }, 404)
    }

    if (!organisation.vaultwd_org_id || !organisation.vaultwd_user_token) {
      return c.json({ error: 'Organisation not properly initialized' }, 503)
    }

    const body = await c.req.json<CreatePasswordRequest>()
    if (!body.name || body.name.trim().length === 0) {
      return c.json({ error: 'Password name is required' }, 400)
    }
    if (!body.password || body.password.length === 0) {
      return c.json({ error: 'Password value is required' }, 400)
    }

    const passwordId = `pwd-${randomBytes(8).toString('hex')}`

    try {
      const cipherId = await vaultwd.createCipher(
        instance.vaultwd_url, 
        organisation.vaultwd_user_token, 
        organisation.vaultwd_org_id, 
        body.name, 
        body.password,
        body.username,
        body.totp,
        body.uris,
        body.notes
      )
      
      const password: Password = {
        id: passwordId,
        organisation_id: organisationId,
        vaultwd_cipher_id: cipherId,
        created_at: Date.now()
      }

      await registry.addPassword(password)

      const response: CreatePasswordResponse = {
        password_id: passwordId,
        organisation_id: organisationId,
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

organisations.get('/instances/:instance_id/organisations/:organisation_id/passwords', async (c) => {
  try {
    const instanceId = c.req.param('instance_id')
    const organisationId = c.req.param('organisation_id')

    const instance = await registry.getInstance(instanceId)
    const organisation = await registry.getOrganisation(organisationId)

    if (!instance) {
      return c.json({ error: 'Instance not found' }, 404)
    }

    if (!organisation || organisation.instance_id !== instanceId) {
      return c.json({ error: 'Organisation not found' }, 404)
    }

    if (!organisation.vaultwd_org_id || !organisation.vaultwd_user_token) {
      return c.json({ error: 'Organisation not properly initialized' }, 503)
    }

    const passwords = await registry.getPasswordsByOrganisation(organisationId)
    const ciphers = await vaultwd.getCiphers(instance.vaultwd_url, organisation.vaultwd_user_token, organisation.vaultwd_org_id)

    const cipherMap = new Map(ciphers.map(cipher => [cipher.id, cipher]))
    
    const passwordsWithData = passwords.map(pwd => ({
      id: pwd.id,
      organisation_id: pwd.organisation_id,
      name: cipherMap.get(pwd.vaultwd_cipher_id)?.name || 'Unknown',
      created_at: pwd.created_at
    }))

    const response: PasswordListResponse = {
      organisation_id: organisationId,
      passwords: passwordsWithData
    }

    return c.json(response)
  } catch (error) {
    console.error('Error fetching passwords:', error)
    return c.json({ error: 'Failed to fetch passwords' }, 500)
  }
})

organisations.get('/instances/:instance_id/organisations/:organisation_id/passwords/:password_id', async (c) => {
  const instanceId = c.req.param('instance_id')
  const organisationId = c.req.param('organisation_id')
  const passwordId = c.req.param('password_id')

  const instance = await registry.getInstance(instanceId)
  const organisation = await registry.getOrganisation(organisationId)
  const password = await registry.getPassword(passwordId)

  if (!instance) {
    return c.json({ error: 'Instance not found' }, 404)
  }

  if (!organisation || organisation.instance_id !== instanceId) {
    return c.json({ error: 'Organisation not found' }, 404)
  }

  if (!password || password.organisation_id !== organisationId) {
    return c.json({ error: 'Password not found' }, 404)
  }

  if (!organisation.vaultwd_user_token) {
    return c.json({ error: 'Organisation not properly initialized' }, 503)
  }

  try {
    const cipher = await vaultwd.getCipher(instance.vaultwd_url, organisation.vaultwd_user_token, password.vaultwd_cipher_id)
    
    return c.json({
      id: password.id,
      organisation_id: password.organisation_id,
      name: cipher.name,
      username: cipher.username,
      password: cipher.password,
      totp: cipher.totp,
      uris: cipher.uris,
      notes: cipher.notes,
      created_at: password.created_at
    })
  } catch (error) {
    console.error('Error fetching cipher:', error)
    return c.json({ error: 'Failed to fetch password' }, 500)
  }
})

organisations.delete('/instances/:instance_id/organisations/:organisation_id/passwords/:password_id', async (c) => {
  const instanceId = c.req.param('instance_id')
  const organisationId = c.req.param('organisation_id')
  const passwordId = c.req.param('password_id')

  const instance = await registry.getInstance(instanceId)
  const organisation = await registry.getOrganisation(organisationId)
  const password = await registry.getPassword(passwordId)

  if (!instance) {
    return c.json({ error: 'Instance not found' }, 404)
  }

  if (!organisation || organisation.instance_id !== instanceId) {
    return c.json({ error: 'Organisation not found' }, 404)
  }

  if (!password || password.organisation_id !== organisationId) {
    return c.json({ error: 'Password not found' }, 404)
  }

  if (!organisation.vaultwd_user_token) {
    return c.json({ error: 'Organisation not properly initialized' }, 503)
  }

  try {
    await vaultwd.deleteCipher(instance.vaultwd_url, organisation.vaultwd_user_token, password.vaultwd_cipher_id)
    await registry.deletePassword(passwordId)
    return c.json({ message: 'Password deleted successfully' })
  } catch (error) {
    console.error('Error deleting cipher:', error)
    return c.json({ error: 'Failed to delete password' }, 500)
  }
})

organisations.put('/instances/:instance_id/organisations/:organisation_id/passwords/:password_id', async (c) => {
  try {
    const instanceId = c.req.param('instance_id')
    const organisationId = c.req.param('organisation_id')
    const passwordId = c.req.param('password_id')

    const instance = await registry.getInstance(instanceId)
    const organisation = await registry.getOrganisation(organisationId)
    const password = await registry.getPassword(passwordId)

    if (!instance) {
      return c.json({ error: 'Instance not found' }, 404)
    }

    if (!organisation || organisation.instance_id !== instanceId) {
      return c.json({ error: 'Organisation not found' }, 404)
    }

    if (!password || password.organisation_id !== organisationId) {
      return c.json({ error: 'Password not found' }, 404)
    }

    if (!organisation.vaultwd_org_id || !organisation.vaultwd_user_token) {
      return c.json({ error: 'Organisation not properly initialized' }, 503)
    }

    const body = await c.req.json<UpdatePasswordRequest>()
    
    if (!body.name && !body.password && !body.username && !body.totp && !body.uris && !body.notes) {
      return c.json({ error: 'At least one field is required' }, 400)
    }

    const cipher = await vaultwd.getCipher(instance.vaultwd_url, organisation.vaultwd_user_token, password.vaultwd_cipher_id)
    
    const newName = body.name !== undefined ? body.name : cipher.name
    const newPassword = body.password !== undefined ? body.password : cipher.password
    const newUsername = body.username !== undefined ? body.username : cipher.username
    const newTotp = body.totp !== undefined ? body.totp : cipher.totp
    const newUris = body.uris !== undefined ? body.uris : cipher.uris
    const newNotes = body.notes !== undefined ? body.notes : cipher.notes

    await vaultwd.updateCipher(
      instance.vaultwd_url,
      organisation.vaultwd_user_token,
      password.vaultwd_cipher_id,
      organisation.vaultwd_org_id,
      newName,
      newPassword,
      newUsername,
      newTotp,
      newUris,
      newNotes
    )

    return c.json({
      id: password.id,
      organisation_id: password.organisation_id,
      name: newName,
      username: newUsername,
      password: newPassword,
      totp: newTotp,
      uris: newUris,
      notes: newNotes,
      created_at: password.created_at
    })
  } catch (error) {
    console.error('Error updating password:', error)
    return c.json({ error: 'Failed to update password' }, 500)
  }
})

export default organisations

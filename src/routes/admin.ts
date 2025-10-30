import { Hono } from 'hono'
import { randomBytes } from 'crypto'
import argon2 from 'argon2'
import type { CreateInstanceRequest, CreateInstanceResponse, Instance, DeploymentEventsResponse, DeploymentLogsResponse } from '../types.js'
import * as registry from '../services/registry.js'
import * as k8s from '../services/k8s.js'
import { getLogs } from '../services/deployment-tracker.js'
import { generateECCKeyPair } from '../services/jwt-service.js'
import { storeInstanceKey } from '../services/key-registry.js'

const admin = new Hono()

admin.post('/instances', async (c) => {
  try {
    const body = await c.req.json<CreateInstanceRequest>()
    
    if (!body.name || body.name.trim().length === 0) {
      return c.json({ error: 'Instance name is required' }, 400)
    }

    const instanceId = `instance-${randomBytes(8).toString('hex')}`
    const plainToken = randomBytes(32).toString('hex')
    const hashedToken = await argon2.hash(plainToken, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    })
     const vaultwd_url = `http://vaultwd-service.${instanceId}.svc.cluster.local`

     const { privateKey, publicKey } = generateECCKeyPair()

    const instance: Instance = {
      id: instanceId,
      name: body.name,
      vaultwd_url,
      vaultwd_admin_token: plainToken,
      status: 'provisioning',
      created_at: Date.now()
    }

    await registry.addInstance(instance)
    await storeInstanceKey(instanceId, publicKey)

    k8s.provisionInstance(instanceId, hashedToken)
      .then(() => {
        registry.updateInstanceStatus(instanceId, 'ready')
        console.log(`Instance ${instanceId} provisioned successfully`)
      })
      .catch((error) => {
        registry.updateInstanceStatus(instanceId, 'failed', error.message)
        console.error(`Failed to provision instance ${instanceId}:`, error)
      })

     const response = {
       instance_id: instance.id,
       vaultwd_url: instance.vaultwd_url,
       admin_token: instance.vaultwd_admin_token,
       jwt_private_key: privateKey,
       status: instance.status
     }

    return c.json(response, 202)
  } catch (error) {
    console.error('Error creating instance:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

admin.get('/instances/:id', async (c) => {
  const instanceId = c.req.param('id')
  const instance = await registry.getInstance(instanceId)

  if (!instance) {
    return c.json({ error: 'Instance not found' }, 404)
  }

  return c.json(instance)
})

admin.get('/instances', async (c) => {
  const instances = await registry.getAllInstances()
  return c.json({ instances })
})

admin.delete('/instances/:id', async (c) => {
  const instanceId = c.req.param('id')
  const instance = await registry.getInstance(instanceId)

  if (!instance) {
    return c.json({ error: 'Instance not found' }, 404)
  }

  try {
    await k8s.deleteInstance(instanceId)
    await registry.deleteInstance(instanceId)
    return c.json({ message: 'Instance deleted successfully' })
  } catch (error) {
    console.error('Error deleting instance:', error)
    return c.json({ error: 'Failed to delete instance' }, 500)
  }
})

admin.get('/deployments', async (c) => {
  const instances = await registry.getAllInstances()
  return c.json({ deployments: instances })
})

admin.get('/deployments/:id', async (c) => {
  const deploymentId = c.req.param('id')
  const deployment = await registry.getDeploymentDetail(deploymentId)

  if (!deployment) {
    return c.json({ error: 'Deployment not found' }, 404)
  }

  return c.json(deployment)
})

admin.get('/deployments/:id/events', async (c) => {
  const deploymentId = c.req.param('id')
  const instance = await registry.getInstance(deploymentId)

  if (!instance) {
    return c.json({ error: 'Deployment not found' }, 404)
  }

  const deployment = await registry.getDeploymentDetail(deploymentId)
  if (!deployment) {
    return c.json({ error: 'Deployment not found' }, 404)
  }

  const response: DeploymentEventsResponse = {
    deployment_id: deploymentId,
    events: deployment.events
  }

  return c.json(response)
})

admin.get('/deployments/:id/logs', async (c) => {
  const deploymentId = c.req.param('id')
  const instance = await registry.getInstance(deploymentId)

  if (!instance) {
    return c.json({ error: 'Deployment not found' }, 404)
  }

  const level = c.req.query('level')
  const since = c.req.query('since')
  const page = parseInt(c.req.query('page') || '1', 10)
  const limit = parseInt(c.req.query('limit') || '100', 10)

  const { logs, total } = await getLogs(deploymentId, {
    level: level as any,
    since: since ? parseInt(since, 10) : undefined,
    limit,
    offset: (page - 1) * limit
  })

  const response: DeploymentLogsResponse = {
    deployment_id: deploymentId,
    logs,
    total,
    page,
    limit
  }

  return c.json(response)
})

export default admin

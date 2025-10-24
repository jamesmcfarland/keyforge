import { Hono } from 'hono'
import { randomBytes } from 'crypto'
import argon2 from 'argon2'
import type { CreateUnionRequest, CreateUnionResponse, Union, DeploymentEventsResponse, DeploymentLogsResponse } from '../types.js'
import * as registry from '../services/registry.js'
import * as k8s from '../services/k8s.js'
import { getLogs } from '../services/deployment-tracker.js'

const admin = new Hono()

admin.post('/unions', async (c) => {
  try {
    const body = await c.req.json<CreateUnionRequest>()
    
    if (!body.name || body.name.trim().length === 0) {
      return c.json({ error: 'Union name is required' }, 400)
    }

    const unionId = `union-${randomBytes(8).toString('hex')}`
    const plainToken = randomBytes(32).toString('hex')
    const hashedToken = await argon2.hash(plainToken, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    })
    const vaultwd_url = `http://vaultwd-service.${unionId}.svc.cluster.local`

    const union: Union = {
      id: unionId,
      name: body.name,
      vaultwd_url,
      vaultwd_admin_token: plainToken,
      status: 'provisioning',
      created_at: Date.now()
    }

    await registry.addUnion(union)

    k8s.provisionUnion(unionId, hashedToken)
      .then(() => {
        registry.updateUnionStatus(unionId, 'ready')
        console.log(`Union ${unionId} provisioned successfully`)
      })
      .catch((error) => {
        registry.updateUnionStatus(unionId, 'failed', error.message)
        console.error(`Failed to provision union ${unionId}:`, error)
      })

    const response: CreateUnionResponse = {
      union_id: union.id,
      vaultwd_url: union.vaultwd_url,
      admin_token: union.vaultwd_admin_token,
      status: union.status
    }

    return c.json(response, 202)
  } catch (error) {
    console.error('Error creating union:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

admin.get('/unions/:id', async (c) => {
  const unionId = c.req.param('id')
  const union = await registry.getUnion(unionId)

  if (!union) {
    return c.json({ error: 'Union not found' }, 404)
  }

  return c.json(union)
})

admin.get('/unions', async (c) => {
  const unions = await registry.getAllUnions()
  return c.json({ unions })
})

admin.delete('/unions/:id', async (c) => {
  const unionId = c.req.param('id')
  const union = await registry.getUnion(unionId)

  if (!union) {
    return c.json({ error: 'Union not found' }, 404)
  }

  try {
    await k8s.deleteUnion(unionId)
    await registry.deleteUnion(unionId)
    return c.json({ message: 'Union deleted successfully' })
  } catch (error) {
    console.error('Error deleting union:', error)
    return c.json({ error: 'Failed to delete union' }, 500)
  }
})

admin.get('/deployments', async (c) => {
  const unions = await registry.getAllUnions()
  return c.json({ deployments: unions })
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
  const union = await registry.getUnion(deploymentId)

  if (!union) {
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
  const union = await registry.getUnion(deploymentId)

  if (!union) {
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

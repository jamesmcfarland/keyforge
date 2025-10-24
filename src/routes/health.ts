import { Hono } from 'hono'
import type { HealthCheck } from '../types.js'
import * as registry from '../services/registry.js'
import * as vaultwd from '../services/vaultwd-client.js'

const health = new Hono()

health.get('/vaultwd/:instance_id', async (c) => {
  const instanceId = c.req.param('instance_id')
  const instance = await registry.getInstance(instanceId)

  if (!instance) {
    return c.json({ error: 'Instance not found' }, 404)
  }

  if (instance.status !== 'ready') {
    return c.json({
      status: 'unhealthy',
      instance_id: instanceId,
      message: `Instance status is ${instance.status}`,
      checked_at: Date.now()
    } as HealthCheck, 503)
  }

  const healthResult = await vaultwd.checkHealth(instance.vaultwd_url)

  const response: HealthCheck = {
    status: healthResult.status,
    instance_id: instanceId,
    message: healthResult.message,
    checked_at: Date.now()
  }

  const statusCode = healthResult.status === 'healthy' ? 200 : 503
  return c.json(response, statusCode)
})

export default health

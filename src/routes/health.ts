import { Hono } from 'hono'
import type { HealthCheck } from '../types.js'
import * as registry from '../services/registry.js'
import * as vaultwd from '../services/vaultwd-client.js'

const health = new Hono()

health.get('/vaultwd/:union_id', async (c) => {
  const unionId = c.req.param('union_id')
  const union = await registry.getUnion(unionId)

  if (!union) {
    return c.json({ error: 'Union not found' }, 404)
  }

  if (union.status !== 'ready') {
    return c.json({
      status: 'unhealthy',
      union_id: unionId,
      message: `Union status is ${union.status}`,
      checked_at: Date.now()
    } as HealthCheck, 503)
  }

  const healthResult = await vaultwd.checkHealth(union.vaultwd_url)

  const response: HealthCheck = {
    status: healthResult.status,
    union_id: unionId,
    message: healthResult.message,
    checked_at: Date.now()
  }

  const statusCode = healthResult.status === 'healthy' ? 200 : 503
  return c.json(response, statusCode)
})

export default health

import { randomBytes } from 'crypto'
import { eq, and, gte, desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { deploymentEvents, deploymentLogs } from '../db/schema.js'
import type { DeploymentEvent, DeploymentLog, DeploymentEventStatus, LogLevel } from '../types.js'

export async function logEvent(
  deploymentId: string,
  step: string,
  status: DeploymentEventStatus,
  message?: string
): Promise<DeploymentEvent> {
  const event: DeploymentEvent = {
    id: `evt-${randomBytes(8).toString('hex')}`,
    deployment_id: deploymentId,
    step,
    status,
    message,
    created_at: Date.now()
  }

  await db.insert(deploymentEvents).values({
    id: event.id,
    deployment_id: event.deployment_id,
    step: event.step,
    status: event.status,
    message: event.message,
    created_at: new Date(event.created_at)
  })

  return event
}

export async function logMessage(
  deploymentId: string,
  level: LogLevel,
  message: string
): Promise<DeploymentLog> {
  const log: DeploymentLog = {
    id: `log-${randomBytes(8).toString('hex')}`,
    deployment_id: deploymentId,
    level,
    message,
    created_at: Date.now()
  }

  await db.insert(deploymentLogs).values({
    id: log.id,
    deployment_id: log.deployment_id,
    level: log.level,
    message: log.message,
    created_at: new Date(log.created_at)
  })

  return log
}

export async function getEvents(deploymentId: string): Promise<DeploymentEvent[]> {
  const results = await db
    .select()
    .from(deploymentEvents)
    .where(eq(deploymentEvents.deployment_id, deploymentId))
    .orderBy(deploymentEvents.created_at)

  return results.map(row => ({
    id: row.id,
    deployment_id: row.deployment_id,
    step: row.step,
    status: row.status as DeploymentEventStatus,
    message: row.message || undefined,
    created_at: row.created_at.getTime()
  }))
}

export async function getLogs(
  deploymentId: string,
  options?: {
    level?: LogLevel
    since?: number
    limit?: number
    offset?: number
  }
): Promise<{ logs: DeploymentLog[]; total: number }> {
  const conditions = [eq(deploymentLogs.deployment_id, deploymentId)]

  if (options?.level) {
    conditions.push(eq(deploymentLogs.level, options.level))
  }

  if (options?.since) {
    conditions.push(gte(deploymentLogs.created_at, new Date(options.since)))
  }

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0]

  const results = await db
    .select()
    .from(deploymentLogs)
    .where(whereClause)
    .orderBy(desc(deploymentLogs.created_at))
    .limit(options?.limit || 100)
    .offset(options?.offset || 0)

  const countResults = await db
    .select()
    .from(deploymentLogs)
    .where(whereClause)

  return {
    logs: results.map(row => ({
      id: row.id,
      deployment_id: row.deployment_id,
      level: row.level as LogLevel,
      message: row.message,
      created_at: row.created_at.getTime()
    })),
    total: countResults.length
  }
}

import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { instances, organisations, passwords } from '../db/schema.js'
import type { Instance, Organisation, Password, DeploymentDetail } from '../types.js'
import { getEvents } from './deployment-tracker.js'

export async function addInstance(instance: Instance): Promise<void> {
  await db.insert(instances).values({
    id: instance.id,
    name: instance.name,
    vaultwd_url: instance.vaultwd_url,
    vaultwd_admin_token: instance.vaultwd_admin_token,
    status: instance.status,
    error: instance.error,
    created_at: new Date(instance.created_at)
  })
}

export async function getInstance(id: string): Promise<Instance | undefined> {
  const result = await db.select().from(instances).where(eq(instances.id, id)).limit(1)
  if (result.length === 0) return undefined
  const row = result[0]
  return {
    id: row.id,
    name: row.name,
    vaultwd_url: row.vaultwd_url,
    vaultwd_admin_token: row.vaultwd_admin_token,
    status: row.status as Instance['status'],
    error: row.error || undefined,
    created_at: row.created_at.getTime()
  }
}

export async function getAllInstances(): Promise<Instance[]> {
  const results = await db.select().from(instances)
  return results.map(row => ({
    id: row.id,
    name: row.name,
    vaultwd_url: row.vaultwd_url,
    vaultwd_admin_token: row.vaultwd_admin_token,
    status: row.status as Instance['status'],
    error: row.error || undefined,
    created_at: row.created_at.getTime()
  }))
}

export async function updateInstanceStatus(id: string, status: Instance['status'], error?: string): Promise<void> {
  await db.update(instances)
    .set({ status, error })
    .where(eq(instances.id, id))
}

export async function updateInstanceUrl(id: string, vaultwd_url: string): Promise<void> {
  await db.update(instances)
    .set({ vaultwd_url })
    .where(eq(instances.id, id))
}

export async function deleteInstance(id: string): Promise<boolean> {
  const result = await db.delete(instances).where(eq(instances.id, id)).returning()
  return result.length > 0
}

export async function addOrganisation(organisation: Organisation): Promise<void> {
  await db.insert(organisations).values({
    id: organisation.id,
    name: organisation.name,
    instance_id: organisation.instance_id,
    vaultwd_org_id: organisation.vaultwd_org_id,
    vaultwd_user_email: organisation.vaultwd_user_email,
    vaultwd_user_token: organisation.vaultwd_user_token,
    status: organisation.status,
    created_at: new Date(organisation.created_at)
  })
}

export async function getOrganisation(id: string): Promise<Organisation | undefined> {
  const result = await db.select().from(organisations).where(eq(organisations.id, id)).limit(1)
  if (result.length === 0) return undefined
  const row = result[0]
  return {
    id: row.id,
    name: row.name,
    instance_id: row.instance_id,
    vaultwd_org_id: row.vaultwd_org_id || undefined,
    vaultwd_user_email: row.vaultwd_user_email || undefined,
    vaultwd_user_token: row.vaultwd_user_token || undefined,
    status: row.status as Organisation['status'],
    created_at: row.created_at.getTime()
  }
}

export async function getOrganisationsByInstance(instance_id: string): Promise<Organisation[]> {
  const results = await db.select().from(organisations).where(eq(organisations.instance_id, instance_id))
  return results.map(row => ({
    id: row.id,
    name: row.name,
    instance_id: row.instance_id,
    vaultwd_org_id: row.vaultwd_org_id || undefined,
    vaultwd_user_email: row.vaultwd_user_email || undefined,
    vaultwd_user_token: row.vaultwd_user_token || undefined,
    status: row.status as Organisation['status'],
    created_at: row.created_at.getTime()
  }))
}

export async function updateOrganisationStatus(id: string, status: Organisation['status']): Promise<void> {
  await db.update(organisations)
    .set({ status })
    .where(eq(organisations.id, id))
}

export async function updateOrganisationOrgId(id: string, vaultwd_org_id: string): Promise<void> {
  await db.update(organisations)
    .set({ vaultwd_org_id })
    .where(eq(organisations.id, id))
}

export async function updateOrganisationUserToken(id: string, vaultwd_user_token: string): Promise<void> {
  await db.update(organisations)
    .set({ vaultwd_user_token })
    .where(eq(organisations.id, id))
}

export async function deleteOrganisation(id: string): Promise<boolean> {
  const result = await db.delete(organisations).where(eq(organisations.id, id)).returning()
  return result.length > 0
}

export async function addPassword(password: Password): Promise<void> {
  await db.insert(passwords).values({
    id: password.id,
    organisation_id: password.organisation_id,
    vaultwd_cipher_id: password.vaultwd_cipher_id,
    created_at: new Date(password.created_at)
  })
}

export async function getPassword(id: string): Promise<Password | undefined> {
  const result = await db.select().from(passwords).where(eq(passwords.id, id)).limit(1)
  if (result.length === 0) return undefined
  const row = result[0]
  return {
    id: row.id,
    organisation_id: row.organisation_id,
    vaultwd_cipher_id: row.vaultwd_cipher_id,
    created_at: row.created_at.getTime()
  }
}

export async function getPasswordsByOrganisation(organisation_id: string): Promise<Password[]> {
  const results = await db.select().from(passwords).where(eq(passwords.organisation_id, organisation_id))
  return results.map(row => ({
    id: row.id,
    organisation_id: row.organisation_id,
    vaultwd_cipher_id: row.vaultwd_cipher_id,
    created_at: row.created_at.getTime()
  }))
}

export async function deletePassword(id: string): Promise<boolean> {
  const result = await db.delete(passwords).where(eq(passwords.id, id)).returning()
  return result.length > 0
}

export async function getDeploymentDetail(instanceId: string): Promise<DeploymentDetail | undefined> {
  const instance = await getInstance(instanceId)
  if (!instance) return undefined

  const organisationsList = await getOrganisationsByInstance(instanceId)
  const events = await getEvents(instanceId)

  return {
    instance,
    organisations: organisationsList,
    events
  }
}

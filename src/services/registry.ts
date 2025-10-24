import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { unions, societies, passwords } from '../db/schema.js'
import type { Union, Society, Password, DeploymentDetail } from '../types.js'
import { getEvents } from './deployment-tracker.js'

export async function addUnion(union: Union): Promise<void> {
  await db.insert(unions).values({
    id: union.id,
    name: union.name,
    vaultwd_url: union.vaultwd_url,
    vaultwd_admin_token: union.vaultwd_admin_token,
    status: union.status,
    error: union.error,
    created_at: new Date(union.created_at)
  })
}

export async function getUnion(id: string): Promise<Union | undefined> {
  const result = await db.select().from(unions).where(eq(unions.id, id)).limit(1)
  if (result.length === 0) return undefined
  const row = result[0]
  return {
    id: row.id,
    name: row.name,
    vaultwd_url: row.vaultwd_url,
    vaultwd_admin_token: row.vaultwd_admin_token,
    status: row.status as Union['status'],
    error: row.error || undefined,
    created_at: row.created_at.getTime()
  }
}

export async function getAllUnions(): Promise<Union[]> {
  const results = await db.select().from(unions)
  return results.map(row => ({
    id: row.id,
    name: row.name,
    vaultwd_url: row.vaultwd_url,
    vaultwd_admin_token: row.vaultwd_admin_token,
    status: row.status as Union['status'],
    error: row.error || undefined,
    created_at: row.created_at.getTime()
  }))
}

export async function updateUnionStatus(id: string, status: Union['status'], error?: string): Promise<void> {
  await db.update(unions)
    .set({ status, error })
    .where(eq(unions.id, id))
}

export async function deleteUnion(id: string): Promise<boolean> {
  const result = await db.delete(unions).where(eq(unions.id, id)).returning()
  return result.length > 0
}

export async function addSociety(society: Society): Promise<void> {
  await db.insert(societies).values({
    id: society.id,
    name: society.name,
    union_id: society.union_id,
    vaultwd_org_id: society.vaultwd_org_id,
    vaultwd_user_email: society.vaultwd_user_email,
    vaultwd_user_token: society.vaultwd_user_token,
    status: society.status,
    created_at: new Date(society.created_at)
  })
}

export async function getSociety(id: string): Promise<Society | undefined> {
  const result = await db.select().from(societies).where(eq(societies.id, id)).limit(1)
  if (result.length === 0) return undefined
  const row = result[0]
  return {
    id: row.id,
    name: row.name,
    union_id: row.union_id,
    vaultwd_org_id: row.vaultwd_org_id || undefined,
    vaultwd_user_email: row.vaultwd_user_email || undefined,
    vaultwd_user_token: row.vaultwd_user_token || undefined,
    status: row.status as Society['status'],
    created_at: row.created_at.getTime()
  }
}

export async function getSocietiesByUnion(union_id: string): Promise<Society[]> {
  const results = await db.select().from(societies).where(eq(societies.union_id, union_id))
  return results.map(row => ({
    id: row.id,
    name: row.name,
    union_id: row.union_id,
    vaultwd_org_id: row.vaultwd_org_id || undefined,
    vaultwd_user_email: row.vaultwd_user_email || undefined,
    vaultwd_user_token: row.vaultwd_user_token || undefined,
    status: row.status as Society['status'],
    created_at: row.created_at.getTime()
  }))
}

export async function updateSocietyStatus(id: string, status: Society['status']): Promise<void> {
  await db.update(societies)
    .set({ status })
    .where(eq(societies.id, id))
}

export async function updateSocietyOrgId(id: string, vaultwd_org_id: string): Promise<void> {
  await db.update(societies)
    .set({ vaultwd_org_id })
    .where(eq(societies.id, id))
}

export async function updateSocietyUserToken(id: string, vaultwd_user_token: string): Promise<void> {
  await db.update(societies)
    .set({ vaultwd_user_token })
    .where(eq(societies.id, id))
}

export async function deleteSociety(id: string): Promise<boolean> {
  const result = await db.delete(societies).where(eq(societies.id, id)).returning()
  return result.length > 0
}

export async function addPassword(password: Password): Promise<void> {
  await db.insert(passwords).values({
    id: password.id,
    society_id: password.society_id,
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
    society_id: row.society_id,
    vaultwd_cipher_id: row.vaultwd_cipher_id,
    created_at: row.created_at.getTime()
  }
}

export async function getPasswordsBySociety(society_id: string): Promise<Password[]> {
  const results = await db.select().from(passwords).where(eq(passwords.society_id, society_id))
  return results.map(row => ({
    id: row.id,
    society_id: row.society_id,
    vaultwd_cipher_id: row.vaultwd_cipher_id,
    created_at: row.created_at.getTime()
  }))
}

export async function deletePassword(id: string): Promise<boolean> {
  const result = await db.delete(passwords).where(eq(passwords.id, id)).returning()
  return result.length > 0
}

export async function getDeploymentDetail(unionId: string): Promise<DeploymentDetail | undefined> {
  const union = await getUnion(unionId)
  if (!union) return undefined

  const societiesList = await getSocietiesByUnion(unionId)
  const events = await getEvents(unionId)

  return {
    union,
    societies: societiesList,
    events
  }
}

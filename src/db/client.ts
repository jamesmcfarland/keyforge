import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://keyforge:keyforge_dev@localhost:5432/keyforge'

const queryClient = postgres(DATABASE_URL)
export const db = drizzle(queryClient, { schema })

export async function closeDatabase(): Promise<void> {
  await queryClient.end()
}

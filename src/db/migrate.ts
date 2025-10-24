import { sql } from 'drizzle-orm'
import { db } from './client.js'

export async function initializeDatabase(): Promise<void> {
  try {
    console.log('Initializing database...')
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS unions (
        id VARCHAR(255) PRIMARY KEY,
        name TEXT NOT NULL,
        vaultwd_url TEXT NOT NULL,
        vaultwd_admin_token TEXT NOT NULL,
        status VARCHAR(50) NOT NULL,
        error TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS societies (
        id VARCHAR(255) PRIMARY KEY,
        name TEXT NOT NULL,
        union_id VARCHAR(255) NOT NULL REFERENCES unions(id) ON DELETE CASCADE,
        vaultwd_org_id TEXT,
        vaultwd_user_email TEXT,
        vaultwd_user_token TEXT,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS passwords (
        id VARCHAR(255) PRIMARY KEY,
        society_id VARCHAR(255) NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
        vaultwd_cipher_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS deployment_events (
        id VARCHAR(255) PRIMARY KEY,
        deployment_id VARCHAR(255) NOT NULL REFERENCES unions(id) ON DELETE CASCADE,
        step VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        message TEXT,
        created_at TIMESTAMP NOT NULL
      )
    `)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS deployment_logs (
        id VARCHAR(255) PRIMARY KEY,
        deployment_id VARCHAR(255) NOT NULL REFERENCES unions(id) ON DELETE CASCADE,
        level VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL
      )
    `)

    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Failed to initialize database:', error)
    throw error
  }
}

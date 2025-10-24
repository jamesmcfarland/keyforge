import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const unions = pgTable('unions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: text('name').notNull(),
  vaultwd_url: text('vaultwd_url').notNull(),
  vaultwd_admin_token: text('vaultwd_admin_token').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  error: text('error'),
  created_at: timestamp('created_at').notNull().defaultNow()
})

export const societies = pgTable('societies', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: text('name').notNull(),
  union_id: varchar('union_id', { length: 255 }).notNull().references(() => unions.id, { onDelete: 'cascade' }),
  vaultwd_org_id: text('vaultwd_org_id'),
  vaultwd_user_email: text('vaultwd_user_email'),
  vaultwd_user_token: text('vaultwd_user_token'),
  status: varchar('status', { length: 50 }).notNull(),
  created_at: timestamp('created_at').notNull().defaultNow()
})

export const passwords = pgTable('passwords', {
  id: varchar('id', { length: 255 }).primaryKey(),
  society_id: varchar('society_id', { length: 255 }).notNull().references(() => societies.id, { onDelete: 'cascade' }),
  vaultwd_cipher_id: varchar('vaultwd_cipher_id', { length: 255 }).notNull(),
  created_at: timestamp('created_at').notNull().defaultNow()
})

export const deploymentEvents = pgTable('deployment_events', {
  id: varchar('id', { length: 255 }).primaryKey(),
  deployment_id: varchar('deployment_id', { length: 255 }).notNull().references(() => unions.id, { onDelete: 'cascade' }),
  step: varchar('step', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  message: text('message'),
  created_at: timestamp('created_at').notNull()
})

export const deploymentLogs = pgTable('deployment_logs', {
  id: varchar('id', { length: 255 }).primaryKey(),
  deployment_id: varchar('deployment_id', { length: 255 }).notNull().references(() => unions.id, { onDelete: 'cascade' }),
  level: varchar('level', { length: 20 }).notNull(),
  message: text('message').notNull(),
  created_at: timestamp('created_at').notNull()
})

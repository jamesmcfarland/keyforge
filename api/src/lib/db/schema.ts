import { date, integer, pgEnum, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const deploymentStatusEnum = pgEnum('deploymentStatus', ['ready', 'in-progress', 'failed', 'queued']);


export const deploymentsTable = pgTable("deployments", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    tenantId: varchar({ length: 100 }).notNull(),
    deploymentId: varchar({ length: 100 }).notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    deploymentStatus: deploymentStatusEnum(),
})
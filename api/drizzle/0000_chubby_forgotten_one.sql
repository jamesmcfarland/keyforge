CREATE TYPE "public"."deploymentStatus" AS ENUM('ready', 'in-progress', 'failed', 'queued');--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "deployments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenantId" varchar(100) NOT NULL,
	"deploymentId" varchar(100) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"deploymentStatus" "deploymentStatus"
);

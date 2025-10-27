CREATE TABLE IF NOT EXISTS "key_pairs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"instance_id" varchar(255),
	"public_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"timestamp" timestamp NOT NULL,
	"endpoint" text NOT NULL,
	"method" varchar(10) NOT NULL,
	"instance_id" varchar(255) NOT NULL,
	"request_id" varchar(255) NOT NULL,
	"metadata" jsonb,
	"response_status" smallint NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "key_pairs" ADD CONSTRAINT "key_pairs_instance_id_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."instances"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_instance_id" ON "audit_logs" USING btree ("instance_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_timestamp" ON "audit_logs" USING btree ("timestamp");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_event_type" ON "audit_logs" USING btree ("event_type");

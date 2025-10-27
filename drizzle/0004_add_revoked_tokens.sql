CREATE TABLE IF NOT EXISTS "revoked_tokens" (
	"jti" varchar(255) PRIMARY KEY NOT NULL,
	"instance_id" varchar(255) NOT NULL,
	"revoked_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "revoked_tokens" ADD CONSTRAINT "revoked_tokens_instance_id_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."instances"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_revoked_tokens_instance_id" ON "revoked_tokens" USING btree ("instance_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_revoked_tokens_expires_at" ON "revoked_tokens" USING btree ("expires_at");

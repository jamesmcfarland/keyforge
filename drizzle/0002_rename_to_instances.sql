ALTER TABLE "unions" RENAME TO "instances";
--> statement-breakpoint
ALTER TABLE "societies" RENAME TO "organisations";
--> statement-breakpoint
ALTER TABLE "organisations" RENAME COLUMN "union_id" TO "instance_id";
--> statement-breakpoint
ALTER TABLE "passwords" RENAME COLUMN "society_id" TO "organisation_id";
--> statement-breakpoint
ALTER TABLE "organisations" DROP CONSTRAINT "societies_union_id_unions_id_fk";
--> statement-breakpoint
ALTER TABLE "passwords" DROP CONSTRAINT "passwords_society_id_societies_id_fk";
--> statement-breakpoint
ALTER TABLE "deployment_events" DROP CONSTRAINT "deployment_events_deployment_id_unions_id_fk";
--> statement-breakpoint
ALTER TABLE "deployment_logs" DROP CONSTRAINT "deployment_logs_deployment_id_unions_id_fk";
--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_instance_id_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."instances"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "passwords" ADD CONSTRAINT "passwords_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "deployment_events" ADD CONSTRAINT "deployment_events_deployment_id_instances_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."instances"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "deployment_logs" ADD CONSTRAINT "deployment_logs_deployment_id_instances_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."instances"("id") ON DELETE cascade ON UPDATE no action;

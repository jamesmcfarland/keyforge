CREATE TABLE "deployment_events" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"deployment_id" varchar(255) NOT NULL,
	"step" varchar(100) NOT NULL,
	"status" varchar(50) NOT NULL,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployment_logs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"deployment_id" varchar(255) NOT NULL,
	"level" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passwords" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"society_id" varchar(255) NOT NULL,
	"vaultwd_cipher_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "societies" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"union_id" varchar(255) NOT NULL,
	"vaultwd_org_id" text,
	"vaultwd_user_email" text,
	"vaultwd_user_token" text,
	"status" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"vaultwd_url" text NOT NULL,
	"vaultwd_admin_token" text NOT NULL,
	"status" varchar(50) NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployment_events" ADD CONSTRAINT "deployment_events_deployment_id_unions_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."unions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_logs" ADD CONSTRAINT "deployment_logs_deployment_id_unions_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."unions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passwords" ADD CONSTRAINT "passwords_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "societies" ADD CONSTRAINT "societies_union_id_unions_id_fk" FOREIGN KEY ("union_id") REFERENCES "public"."unions"("id") ON DELETE cascade ON UPDATE no action;
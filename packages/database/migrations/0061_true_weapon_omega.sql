CREATE TABLE "server_configs" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY DEFAULT '1' NOT NULL,
	"enable_signup" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_blocked" boolean DEFAULT false;
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text,
	"user_id" text,
	"actor_name" text NOT NULL,
	"actor_email" text,
	"via_admin" text,
	"action" text NOT NULL,
	"summary" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_log_business_id_businesses_id_fk') THEN
    ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_log_user_id_users_id_fk') THEN
    ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_business_created" ON "audit_log" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_created" ON "audit_log" USING btree ("created_at");
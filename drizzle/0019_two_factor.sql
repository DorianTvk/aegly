ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "mfa_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_last_step" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "recovery_codes" jsonb DEFAULT '[]'::jsonb NOT NULL;
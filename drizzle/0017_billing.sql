ALTER TYPE "public"."plan_status" ADD VALUE IF NOT EXISTS 'PENDING';--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "plan_cancel_at" timestamp with time zone;
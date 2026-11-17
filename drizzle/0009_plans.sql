CREATE TYPE "public"."plan" AS ENUM('SOLO', 'SALONG', 'SUUR');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('ACTIVE', 'PAST_DUE', 'SUSPENDED');--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "plan" "plan" DEFAULT 'SALONG' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "billing_period" text DEFAULT 'MONTH' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "plan_status" "plan_status" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "plan_renews_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "plan_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "stripe_subscription_id" text;
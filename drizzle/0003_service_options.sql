CREATE TYPE "public"."price_type" AS ENUM('FIXED', 'FROM', 'FREE', 'HIDDEN');--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "buffer_before_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "price_type" "price_type" DEFAULT 'FIXED' NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "show_price" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "allow_staff_choice" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "min_lead_minutes" integer;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "max_advance_days" integer;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "cancel_until_hours" integer;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "updated_by" text;
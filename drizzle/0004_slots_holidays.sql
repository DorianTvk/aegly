ALTER TABLE "businesses" ADD COLUMN "slot_mode" text DEFAULT 'ALL' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "use_national_holidays" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "invited_at" timestamp with time zone;
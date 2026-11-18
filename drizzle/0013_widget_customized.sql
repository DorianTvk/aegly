ALTER TABLE "businesses" ADD COLUMN "widget_customized_at" timestamp with time zone;--> statement-breakpoint
UPDATE "businesses" SET "widget_customized_at" = now() WHERE "logo_url" IS NOT NULL OR "widget_primary" <> '#0f766e';

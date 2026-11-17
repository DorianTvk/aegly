ALTER TYPE "public"."adjustment_kind" ADD VALUE 'FIXED_PRICE';--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "banner_text" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "banner_color" text DEFAULT '#fff4ed' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "package_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN "category_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN "package_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "shareable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "price_rules" ADD COLUMN "date_from" date;--> statement-breakpoint
ALTER TABLE "price_rules" ADD COLUMN "date_to" date;--> statement-breakpoint
ALTER TABLE "price_rules" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;
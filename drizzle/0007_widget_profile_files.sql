CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "instagram" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "facebook" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "logo_in_emails" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "widget_button_color" text DEFAULT '#ffffff' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "widget_background" text DEFAULT '#ffffff' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "widget_text_color" text DEFAULT '#1f2a2a' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "widget_font" text DEFAULT 'inherit' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "widget_show_logo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "widget_show_banner" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "widget_show_campaign_banner" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "widget_languages" text[] DEFAULT '{et}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "widget_embed" text DEFAULT 'popup' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "widget_installed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
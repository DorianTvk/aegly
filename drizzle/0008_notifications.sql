CREATE TYPE "public"."notification_type" AS ENUM('CONFIRMATION', 'REMINDER', 'CHANGED', 'CANCELLED', 'PAYMENT_PENDING', 'WAITLIST', 'REVIEW', 'BIRTHDAY');--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"email_enabled" boolean NOT NULL,
	"sms_enabled" boolean NOT NULL,
	"offset_minutes" integer,
	"email_subject" text,
	"email_body" text,
	"sms_body" text
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "email_sender_name" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "sms_sender" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "reply_to_email" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "google_review_url" text;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_settings_business_type" ON "notification_settings" USING btree ("business_id","type");
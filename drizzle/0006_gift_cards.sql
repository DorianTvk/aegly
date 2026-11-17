CREATE TABLE "gift_card_redemptions" (
	"id" text PRIMARY KEY NOT NULL,
	"gift_card_id" text NOT NULL,
	"booking_id" text,
	"amount_cents" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "gift_cards_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "gift_card_amounts" integer[] DEFAULT '{2500,5000,7500,10000}'::int[] NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "gift_card_custom_amount" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "gift_card_min_cents" integer DEFAULT 2000 NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "gift_card_validity_months" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD COLUMN "source" text DEFAULT 'ADMIN' NOT NULL;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "gift_card_redemptions" ADD CONSTRAINT "gift_card_redemptions_gift_card_id_gift_cards_id_fk" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_redemptions" ADD CONSTRAINT "gift_card_redemptions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
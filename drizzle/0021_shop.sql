CREATE TABLE IF NOT EXISTS "shop_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"amount_cents" integer NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_email" text NOT NULL,
	"buyer_phone" text,
	"lang" text DEFAULT 'et' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_account_id" text,
	"stripe_payment_intent_id" text,
	"result_id" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_orders_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "gift_card_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "gift_card_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_orders_business_id_businesses_id_fk') THEN
    ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_orders_business_created" ON "shop_orders" USING btree ("business_id","created_at");
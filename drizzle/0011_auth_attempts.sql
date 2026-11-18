CREATE TABLE "auth_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"ip" text NOT NULL,
	"email" text,
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_attempts_ip_created" ON "auth_attempts" USING btree ("ip","created_at");--> statement-breakpoint
CREATE INDEX "auth_attempts_email_created" ON "auth_attempts" USING btree ("email","created_at");
DROP INDEX "users_business_email";--> statement-breakpoint
CREATE UNIQUE INDEX "users_email" ON "users" USING btree ("email");
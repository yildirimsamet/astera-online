CREATE TABLE "bot_profiles" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"ordinal" integer NOT NULL,
	"persona" text NOT NULL,
	"next_action_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bot_profiles" ADD CONSTRAINT "bot_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bot_profiles_ordinal_idx" ON "bot_profiles" USING btree ("ordinal");--> statement-breakpoint
CREATE INDEX "bot_profiles_due_idx" ON "bot_profiles" USING btree ("next_action_at");
-- PLAN 2026-11-06 §7.2 (Faz 4.9): NEW COMMANDER 7 DAYS. One row an account, written on its first box:
-- how many boxes are open and when the last one was. A new table only; nothing existing changes.
CREATE TABLE "welcome_week" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"opened" integer DEFAULT 0 NOT NULL,
	"last_opened_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "welcome_week" ADD CONSTRAINT "welcome_week_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
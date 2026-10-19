ALTER TABLE "announcements" DROP CONSTRAINT "announcements_author_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "commander_transfers" DROP CONSTRAINT "commander_transfers_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "announcements" ALTER COLUMN "author_account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "commander_transfers" ALTER COLUMN "account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_account_id_accounts_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commander_transfers" ADD CONSTRAINT "commander_transfers_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
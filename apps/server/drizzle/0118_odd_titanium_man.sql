CREATE TABLE "chat_archive" (
	"id" uuid PRIMARY KEY NOT NULL,
	"season_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"language" text,
	"clan_id" uuid,
	"clan_tag" text,
	"clan_name" text,
	"author_account_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"archived_at" timestamp with time zone NOT NULL,
	CONSTRAINT "chat_archive_channel_check" CHECK ("chat_archive"."channel" IN ('GALAXY', 'CLAN'))
);
--> statement-breakpoint
ALTER TABLE "chat_archive" ADD CONSTRAINT "chat_archive_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_archive" ADD CONSTRAINT "chat_archive_author_account_id_accounts_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_archive_season_idx" ON "chat_archive" USING btree ("season_id","channel","created_at");--> statement-breakpoint
CREATE INDEX "chat_archive_author_idx" ON "chat_archive" USING btree ("author_account_id");
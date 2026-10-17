CREATE TABLE "chat_media_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_account_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"channel" text,
	"message_id" uuid
);
--> statement-breakpoint
ALTER TABLE "clan_messages" DROP CONSTRAINT "clan_messages_content_check";--> statement-breakpoint
ALTER TABLE "dm_messages" DROP CONSTRAINT "dm_messages_content_check";--> statement-breakpoint
ALTER TABLE "chat_archive" ADD COLUMN "media" jsonb;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "media" jsonb;--> statement-breakpoint
ALTER TABLE "clan_messages" ADD COLUMN "media" jsonb;--> statement-breakpoint
ALTER TABLE "dm_archive" ADD COLUMN "media" jsonb;--> statement-breakpoint
ALTER TABLE "dm_messages" ADD COLUMN "media" jsonb;--> statement-breakpoint
ALTER TABLE "chat_media_assets" ADD CONSTRAINT "chat_media_assets_owner_account_id_accounts_id_fk" FOREIGN KEY ("owner_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_media_assets_pending_idx" ON "chat_media_assets" USING btree ("claimed_at","created_at");--> statement-breakpoint
ALTER TABLE "clan_messages" ADD CONSTRAINT "clan_messages_content_check" CHECK (char_length(btrim("clan_messages"."content")) <= 280 AND (char_length(btrim("clan_messages"."content")) >= 1 OR "clan_messages"."media" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "dm_messages" ADD CONSTRAINT "dm_messages_content_check" CHECK (char_length(btrim("dm_messages"."content")) <= 280 AND (char_length(btrim("dm_messages"."content")) >= 1 OR "dm_messages"."media" IS NOT NULL));
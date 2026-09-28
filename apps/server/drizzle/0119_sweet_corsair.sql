CREATE TABLE "dm_archive" (
	"id" uuid PRIMARY KEY NOT NULL,
	"season_id" uuid NOT NULL,
	"sender_account_id" uuid NOT NULL,
	"recipient_account_id" uuid NOT NULL,
	"sender_name" text NOT NULL,
	"recipient_name" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"archived_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dm_blocks" (
	"blocker_player_id" uuid NOT NULL,
	"target_player_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "dm_blocks_blocker_player_id_target_player_id_pk" PRIMARY KEY("blocker_player_id","target_player_id"),
	CONSTRAINT "dm_blocks_distinct_check" CHECK ("dm_blocks"."blocker_player_id" <> "dm_blocks"."target_player_id")
);
--> statement-breakpoint
CREATE TABLE "dm_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"player_low_id" uuid NOT NULL,
	"player_high_id" uuid NOT NULL,
	CONSTRAINT "dm_conversations_order_check" CHECK ("dm_conversations"."player_low_id" < "dm_conversations"."player_high_id")
);
--> statement-breakpoint
CREATE TABLE "dm_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"author_player_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "dm_messages_content_check" CHECK (char_length(btrim("dm_messages"."content")) BETWEEN 1 AND 280)
);
--> statement-breakpoint
CREATE TABLE "dm_read_markers" (
	"conversation_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "dm_read_markers_conversation_id_player_id_pk" PRIMARY KEY("conversation_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "dm_archive" ADD CONSTRAINT "dm_archive_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_archive" ADD CONSTRAINT "dm_archive_sender_account_id_accounts_id_fk" FOREIGN KEY ("sender_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_archive" ADD CONSTRAINT "dm_archive_recipient_account_id_accounts_id_fk" FOREIGN KEY ("recipient_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_blocks" ADD CONSTRAINT "dm_blocks_blocker_player_id_players_id_fk" FOREIGN KEY ("blocker_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_blocks" ADD CONSTRAINT "dm_blocks_target_player_id_players_id_fk" FOREIGN KEY ("target_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_conversations" ADD CONSTRAINT "dm_conversations_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_conversations" ADD CONSTRAINT "dm_conversations_player_low_id_players_id_fk" FOREIGN KEY ("player_low_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_conversations" ADD CONSTRAINT "dm_conversations_player_high_id_players_id_fk" FOREIGN KEY ("player_high_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_messages" ADD CONSTRAINT "dm_messages_conversation_id_dm_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."dm_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_messages" ADD CONSTRAINT "dm_messages_author_player_id_players_id_fk" FOREIGN KEY ("author_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_read_markers" ADD CONSTRAINT "dm_read_markers_conversation_id_dm_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."dm_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_read_markers" ADD CONSTRAINT "dm_read_markers_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dm_archive_season_idx" ON "dm_archive" USING btree ("season_id","created_at");--> statement-breakpoint
CREATE INDEX "dm_archive_sender_idx" ON "dm_archive" USING btree ("sender_account_id");--> statement-breakpoint
CREATE INDEX "dm_archive_recipient_idx" ON "dm_archive" USING btree ("recipient_account_id");--> statement-breakpoint
CREATE INDEX "dm_blocks_target_idx" ON "dm_blocks" USING btree ("target_player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dm_conversations_pair_idx" ON "dm_conversations" USING btree ("season_id","player_low_id","player_high_id");--> statement-breakpoint
CREATE INDEX "dm_conversations_high_idx" ON "dm_conversations" USING btree ("player_high_id");--> statement-breakpoint
CREATE INDEX "dm_messages_cursor_idx" ON "dm_messages" USING btree ("conversation_id","created_at","id");--> statement-breakpoint
CREATE INDEX "dm_messages_author_rate_idx" ON "dm_messages" USING btree ("author_player_id","created_at");
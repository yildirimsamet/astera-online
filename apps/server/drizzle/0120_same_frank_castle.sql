CREATE TABLE "message_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_message_id" uuid,
	"clan_message_id" uuid,
	"dm_message_id" uuid,
	"player_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "message_reactions_target_check" CHECK (num_nonnulls("message_reactions"."chat_message_id", "message_reactions"."clan_message_id", "message_reactions"."dm_message_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "reply_to_message_id" uuid;--> statement-breakpoint
ALTER TABLE "clan_messages" ADD COLUMN "reply_to_message_id" uuid;--> statement-breakpoint
ALTER TABLE "dm_messages" ADD COLUMN "reply_to_message_id" uuid;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_chat_message_id_chat_messages_id_fk" FOREIGN KEY ("chat_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_clan_message_id_clan_messages_id_fk" FOREIGN KEY ("clan_message_id") REFERENCES "public"."clan_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_dm_message_id_dm_messages_id_fk" FOREIGN KEY ("dm_message_id") REFERENCES "public"."dm_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "message_reactions_chat_player_idx" ON "message_reactions" USING btree ("chat_message_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_reactions_clan_player_idx" ON "message_reactions" USING btree ("clan_message_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_reactions_dm_player_idx" ON "message_reactions" USING btree ("dm_message_id","player_id");--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_reply_to_message_id_chat_messages_id_fk" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_messages" ADD CONSTRAINT "clan_messages_reply_to_message_id_clan_messages_id_fk" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."clan_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_messages" ADD CONSTRAINT "dm_messages_reply_to_message_id_dm_messages_id_fk" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."dm_messages"("id") ON DELETE set null ON UPDATE no action;
CREATE TABLE "chat_read_markers" (
	"player_id" uuid NOT NULL,
	"language" text NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "chat_read_markers_player_id_language_pk" PRIMARY KEY("player_id","language")
);
--> statement-breakpoint
DROP INDEX "chat_messages_season_cursor_idx";--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "language" text DEFAULT 'tr' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_read_markers" ADD CONSTRAINT "chat_read_markers_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_read_markers_player_idx" ON "chat_read_markers" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "chat_messages_season_language_cursor_idx" ON "chat_messages" USING btree ("season_id","language","created_at","id");
--> statement-breakpoint
INSERT INTO "chat_read_markers" ("player_id", "language", "read_at")
SELECT "id", 'tr', "last_chat_read_at"
FROM "players"
WHERE "last_chat_read_at" IS NOT NULL
ON CONFLICT ("player_id", "language") DO NOTHING;

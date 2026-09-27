ALTER TABLE "bot_profiles" ADD COLUMN "retired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bot_profiles" ADD COLUMN "session_player_id" uuid;--> statement-breakpoint
ALTER TABLE "bot_profiles" ADD COLUMN "session_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bot_profiles" ADD COLUMN "session_until_at" timestamp with time zone;
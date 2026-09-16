ALTER TABLE "mining_runs" ADD COLUMN "owner_player_id" uuid;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "stats_owner_player_id" uuid;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "season_telemetry" jsonb DEFAULT '{"produced":{"alloy":0,"crystal":0,"deuterium":0},"productiveSeconds":0,"shipsBuilt":{}}'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "planets" SET "stats_owner_player_id" = "player_id" WHERE "player_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "mining_runs" ADD CONSTRAINT "mining_runs_owner_player_id_players_id_fk" FOREIGN KEY ("owner_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planets" ADD CONSTRAINT "planets_stats_owner_player_id_players_id_fk" FOREIGN KEY ("stats_owner_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;

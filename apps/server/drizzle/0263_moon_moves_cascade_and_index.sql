-- P0/P2 moon audit fixes: cascade moon_moves on player deletion & index jump flash lookup.
ALTER TABLE "moon_moves" DROP CONSTRAINT IF EXISTS "moon_moves_owner_player_id_players_id_fk";--> statement-breakpoint
ALTER TABLE "moon_moves" ADD CONSTRAINT "moon_moves_owner_player_id_players_id_fk" FOREIGN KEY ("owner_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "moon_moves_season_jump_arrive_idx" ON "moon_moves" USING btree ("season_id","arrive_at") WHERE "moon_moves"."kind" = 'JUMP';

-- Scaling plan F1.8 (N6). Every key into players, planets and missions leads an index, so a reclaim
-- checks each one by index. Plain CREATE INDEX: the migrator runs in one transaction, where CONCURRENTLY
-- is refused; at today's table sizes each build takes milliseconds. On a larger table build it CONCURRENTLY by hand first; IF NOT EXISTS then skips it.
CREATE INDEX IF NOT EXISTS "attack_commitments_target_idx" ON "attack_commitments" USING btree ("target_player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_target_planet_idx" ON "battle_reports" USING btree ("target_planet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_aid_sender_home_idx" ON "clan_aid_commitments" USING btree ("sender_home_planet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_ceasefires_low_idx" ON "clan_ceasefires" USING btree ("player_low_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_ceasefires_high_idx" ON "clan_ceasefires" USING btree ("player_high_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_treasury_events_source_planet_idx" ON "clan_treasury_events" USING btree ("source_planet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_war_operations_staging_idx" ON "clan_war_operations" USING btree ("staging_planet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clan_war_operations_leader_idx" ON "clan_war_operations" USING btree ("leader_player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "debris_mission_idx" ON "debris_fields" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dm_conversations_low_idx" ON "dm_conversations" USING btree ("player_low_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dm_read_markers_player_idx" ON "dm_read_markers" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_reactions_player_idx" ON "message_reactions" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "neutral_planet_claim_priority_idx" ON "neutral_planet_state" USING btree ("claim_priority_player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pirate_state_destroyed_by_idx" ON "pirate_state" USING btree ("destroyed_by_player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "planets_stats_owner_idx" ON "planets" USING btree ("stats_owner_player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "probe_reports_target_idx" ON "probe_reports" USING btree ("target_planet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "probe_world_memories_target_idx" ON "probe_world_memories" USING btree ("target_planet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "radiation_bomb_flights_owner_idx" ON "radiation_bomb_flights" USING btree ("owner_player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scans_origin_idx" ON "scan_events" USING btree ("origin_planet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "season_telemetry_segments_player_idx" ON "season_telemetry_segments" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strategic_impacts_target_idx" ON "strategic_impacts" USING btree ("target_planet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strategic_interceptions_target_idx" ON "strategic_interceptions" USING btree ("target_planet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strategic_interceptions_attacker_idx" ON "strategic_interceptions" USING btree ("attacker_player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trade_runs_owner_idx" ON "trade_runs" USING btree ("owner_player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "units_owner_idx" ON "units" USING btree ("owner_player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watches_target_idx" ON "watches" USING btree ("target_planet_id");
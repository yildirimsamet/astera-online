DROP INDEX "attack_commitments_mission_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "attack_commitments_mission_idx" ON "attack_commitments" USING btree ("mission_id","attacker_player_id");
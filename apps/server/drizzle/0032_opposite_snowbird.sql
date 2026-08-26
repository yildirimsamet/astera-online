ALTER TABLE "clan_loot_shares" DROP CONSTRAINT "clan_loot_shares_source_mission_id_missions_id_fk";
--> statement-breakpoint
ALTER TABLE "clan_score_events" DROP CONSTRAINT "clan_score_events_mission_id_missions_id_fk";
--> statement-breakpoint
ALTER TABLE "attack_commitments" ADD COLUMN "defender_clan_id" uuid;--> statement-breakpoint
ALTER TABLE "attack_commitments" ADD CONSTRAINT "attack_commitments_defender_clan_id_clans_id_fk" FOREIGN KEY ("defender_clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "attack_commitments" ADD COLUMN "attacker_clan_id" uuid;--> statement-breakpoint
-- Seed the new immutable snapshot from the quota column it was split out of.
-- For a launch that was never rebound the two are the same fact; for one that was,
-- this is the closest the old rows can get, and nothing rewrites it again.
UPDATE "attack_commitments" SET "attacker_clan_id" = "quota_clan_id";--> statement-breakpoint
ALTER TABLE "attack_commitments" ADD CONSTRAINT "attack_commitments_attacker_clan_id_clans_id_fk" FOREIGN KEY ("attacker_clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;

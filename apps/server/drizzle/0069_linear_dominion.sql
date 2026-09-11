-- D2 v7: Dominion is exact integer economic exchange. Refuse dirty legacy
-- values instead of silently rounding a ladder during the type change.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT dominion_taken::double precision AS value FROM players
      UNION ALL SELECT dominion_lost::double precision FROM players
      UNION ALL SELECT dominion_taken::double precision FROM clans
      UNION ALL SELECT dominion_lost::double precision FROM clans
      UNION ALL SELECT dominion_delta::double precision FROM clan_score_events
      UNION ALL SELECT dominion_swing::double precision FROM battle_reports WHERE dominion_swing IS NOT NULL
      UNION ALL SELECT dominion::double precision FROM season_results
    ) legacy
    WHERE value::text IN ('NaN', 'Infinity', '-Infinity')
       OR value <> trunc(value)
       OR abs(value) > 9007199254740991
  ) THEN
    RAISE EXCEPTION 'Dominion migration requires finite safe integer legacy values';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "players" ALTER COLUMN "dominion_taken" TYPE bigint USING ("dominion_taken"::bigint);
--> statement-breakpoint
ALTER TABLE "players" ALTER COLUMN "dominion_lost" TYPE bigint USING ("dominion_lost"::bigint);
--> statement-breakpoint
ALTER TABLE "clans" ALTER COLUMN "dominion_taken" TYPE bigint USING ("dominion_taken"::bigint);
--> statement-breakpoint
ALTER TABLE "clans" ALTER COLUMN "dominion_lost" TYPE bigint USING ("dominion_lost"::bigint);
--> statement-breakpoint
ALTER TABLE "clan_score_events" ALTER COLUMN "dominion_delta" TYPE bigint USING ("dominion_delta"::bigint);
--> statement-breakpoint
ALTER TABLE "battle_reports" ALTER COLUMN "dominion_swing" TYPE bigint USING ("dominion_swing"::bigint);
--> statement-breakpoint
ALTER TABLE "season_results" ALTER COLUMN "dominion" TYPE bigint USING ("dominion"::bigint);
--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "dominion_rule_version" integer;
--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "dominion_loot_value" bigint;
--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "dominion_attacker_loss_value" bigint;
--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "dominion_defender_loss_value" bigint;
--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "dominion_raw_exchange" bigint;
--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_dominion_range_check"
  CHECK ("dominion_taken" BETWEEN 0 AND 9007199254740991
    AND "dominion_lost" BETWEEN 0 AND 9007199254740991);
--> statement-breakpoint
ALTER TABLE "clans" ADD CONSTRAINT "clans_dominion_range_check"
  CHECK ("dominion_taken" BETWEEN 0 AND 9007199254740991
    AND "dominion_lost" BETWEEN 0 AND 9007199254740991);
--> statement-breakpoint
ALTER TABLE "clan_score_events" ADD CONSTRAINT "clan_score_events_dominion_range_check"
  CHECK ("dominion_delta" BETWEEN -9007199254740991 AND 9007199254740991);
--> statement-breakpoint
ALTER TABLE "season_results" ADD CONSTRAINT "season_results_dominion_range_check"
  CHECK ("dominion" BETWEEN -9007199254740991 AND 9007199254740991);
--> statement-breakpoint
ALTER TABLE "battle_reports" ADD CONSTRAINT "battle_reports_dominion_audit_check" CHECK (
  ("dominion_rule_version" IS NULL
    AND "dominion_loot_value" IS NULL
    AND "dominion_attacker_loss_value" IS NULL
    AND "dominion_defender_loss_value" IS NULL
    AND "dominion_raw_exchange" IS NULL)
  OR ("target_kind" = 'PLAYER'
    AND "dominion_rule_version" > 0
    AND "dominion_loot_value" >= 0
    AND "dominion_attacker_loss_value" >= 0
    AND "dominion_defender_loss_value" >= 0
    AND "dominion_raw_exchange" = "dominion_loot_value"
      + "dominion_defender_loss_value" - "dominion_attacker_loss_value"
    AND "dominion_swing" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "battle_reports" ADD CONSTRAINT "battle_reports_dominion_range_check" CHECK (
  ("dominion_swing" IS NULL
    OR "dominion_swing" BETWEEN -9007199254740991 AND 9007199254740991)
  AND ("dominion_loot_value" IS NULL
    OR "dominion_loot_value" BETWEEN 0 AND 9007199254740991)
  AND ("dominion_attacker_loss_value" IS NULL
    OR "dominion_attacker_loss_value" BETWEEN 0 AND 9007199254740991)
  AND ("dominion_defender_loss_value" IS NULL
    OR "dominion_defender_loss_value" BETWEEN 0 AND 9007199254740991)
  AND ("dominion_raw_exchange" IS NULL
    OR "dominion_raw_exchange" BETWEEN -9007199254740991 AND 9007199254740991)
);

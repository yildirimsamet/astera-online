ALTER TABLE "pirate_state" ADD COLUMN "loot_paid" jsonb DEFAULT '{"alloy":0,"crystal":0,"deuterium":0}'::jsonb NOT NULL;
--> statement-breakpoint
-- Past raids already loaded this hoard, even if they lost it on the return leg.
-- Reports retain the original loaded amount; raid.loot may have been cargo-capped
-- after return radiation. Salvage and captured ships are separate receipts.
UPDATE "pirate_state" AS "state"
SET "loot_paid" = jsonb_build_object(
  'alloy', "receipts"."alloy", 'crystal', "receipts"."crystal", 'deuterium', "receipts"."deuterium"
)
FROM (
  SELECT "raid"."season_id", "raid"."pirate_index",
    sum(coalesce(("report"."loot"->>'alloy')::numeric, 0)) AS "alloy",
    sum(coalesce(("report"."loot"->>'crystal')::numeric, 0)) AS "crystal",
    sum(coalesce(("report"."loot"->>'deuterium')::numeric, 0)) AS "deuterium"
  FROM "battle_reports" AS "report"
  INNER JOIN "pirate_raids" AS "raid" ON "raid"."id" = "report"."pirate_raid_id"
  WHERE "report"."target_kind" = 'PIRATE'
  GROUP BY "raid"."season_id", "raid"."pirate_index"
) AS "receipts"
WHERE "state"."season_id" = "receipts"."season_id"
  AND "state"."index" = "receipts"."pirate_index";

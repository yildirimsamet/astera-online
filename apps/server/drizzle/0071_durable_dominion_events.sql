-- D2 v7: score reconciliation must survive idle-seat reclaim, which deletes the
-- live player, its missions and its player-facing battle reports.
CREATE TABLE "dominion_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "season_id" uuid NOT NULL,
  "mission_id" uuid NOT NULL,
  "attacker_player_id" uuid NOT NULL,
  "defender_player_id" uuid NOT NULL,
  "ruleset_version" integer NOT NULL,
  "eligible" boolean NOT NULL,
  "loot_value" bigint,
  "attacker_loss_value" bigint,
  "defender_loss_value" bigint,
  "raw_exchange" bigint,
  "transfer" bigint NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "dominion_events_audit_check" CHECK (
    "ruleset_version" > 0 AND (
      ("eligible" = false
        AND "transfer" = 0
        AND "loot_value" IS NULL
        AND "attacker_loss_value" IS NULL
        AND "defender_loss_value" IS NULL
        AND "raw_exchange" IS NULL)
      OR ("eligible" = true
        AND "loot_value" BETWEEN 0 AND 9007199254740991
        AND "attacker_loss_value" BETWEEN 0 AND 9007199254740991
        AND "defender_loss_value" BETWEEN 0 AND 9007199254740991
        AND "raw_exchange" BETWEEN -9007199254740991 AND 9007199254740991
        AND "transfer" BETWEEN -9007199254740991 AND 9007199254740991
        AND "raw_exchange" = "loot_value" + "defender_loss_value" - "attacker_loss_value"
        AND ("ruleset_version" < 7 OR "raw_exchange" = "transfer"))
    )
  )
);
--> statement-breakpoint
ALTER TABLE "dominion_events" ADD CONSTRAINT "dominion_events_season_id_seasons_id_fk"
  FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "dominion_events_mission_idx" ON "dominion_events" USING btree ("mission_id");
--> statement-breakpoint
CREATE INDEX "dominion_events_season_idx" ON "dominion_events" USING btree ("season_id");
--> statement-breakpoint
INSERT INTO "dominion_events" (
  "season_id", "mission_id", "attacker_player_id", "defender_player_id",
  "ruleset_version", "eligible", "loot_value", "attacker_loss_value",
  "defender_loss_value", "raw_exchange", "transfer", "created_at"
)
SELECT
  report."season_id", report."mission_id", report."attacker_player_id",
  report."defender_player_id", COALESCE(report."dominion_rule_version", season."ruleset_version"),
  report."dominion_eligible", report."dominion_loot_value",
  report."dominion_attacker_loss_value", report."dominion_defender_loss_value",
  report."dominion_raw_exchange", report."dominion_swing", report."created_at"
FROM "battle_reports" report
INNER JOIN "seasons" season ON season."id" = report."season_id"
WHERE report."target_kind" = 'PLAYER'
  AND report."mission_id" IS NOT NULL
  AND report."defender_player_id" IS NOT NULL
  AND report."dominion_eligible" IS NOT NULL
ON CONFLICT ("mission_id") DO NOTHING;

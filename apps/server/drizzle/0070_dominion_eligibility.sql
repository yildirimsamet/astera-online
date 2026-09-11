-- D2 v7: make score eligibility an immutable part of the battle journal. A
-- zero transfer with no equation is not enough to infer an operator exemption.
ALTER TABLE "battle_reports" ADD COLUMN "dominion_eligible" boolean;
--> statement-breakpoint
UPDATE "battle_reports"
SET "dominion_eligible" = CASE
  WHEN "target_kind" = 'PLAYER' AND "dominion_rule_version" IS NOT NULL THEN true
  ELSE NULL
END;
--> statement-breakpoint
ALTER TABLE "battle_reports" DROP CONSTRAINT "battle_reports_dominion_audit_check";
--> statement-breakpoint
ALTER TABLE "battle_reports" ADD CONSTRAINT "battle_reports_dominion_audit_check" CHECK (
  ("dominion_eligible" IS NULL
    AND "dominion_rule_version" IS NULL
    AND "dominion_loot_value" IS NULL
    AND "dominion_attacker_loss_value" IS NULL
    AND "dominion_defender_loss_value" IS NULL
    AND "dominion_raw_exchange" IS NULL)
  OR ("dominion_eligible" = false
    AND "target_kind" = 'PLAYER'
    AND "dominion_swing" = 0
    AND "dominion_rule_version" IS NULL
    AND "dominion_loot_value" IS NULL
    AND "dominion_attacker_loss_value" IS NULL
    AND "dominion_defender_loss_value" IS NULL
    AND "dominion_raw_exchange" IS NULL)
  OR ("dominion_eligible" = true
    AND "target_kind" = 'PLAYER'
    AND "dominion_rule_version" > 0
    AND "dominion_loot_value" >= 0
    AND "dominion_attacker_loss_value" >= 0
    AND "dominion_defender_loss_value" >= 0
    AND "dominion_raw_exchange" = "dominion_loot_value"
      + "dominion_defender_loss_value" - "dominion_attacker_loss_value"
    AND "dominion_swing" IS NOT NULL
    AND ("dominion_rule_version" < 7
      OR "dominion_raw_exchange" = "dominion_swing"))
);

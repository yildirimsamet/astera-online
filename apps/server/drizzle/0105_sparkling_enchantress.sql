ALTER TABLE "battle_reports" DROP CONSTRAINT "battle_reports_dominion_audit_check";--> statement-breakpoint
ALTER TABLE "battle_reports" ADD CONSTRAINT "battle_reports_dominion_audit_check" CHECK (("battle_reports"."dominion_eligible" IS NULL
          AND "battle_reports"."dominion_rule_version" IS NULL
          AND "battle_reports"."dominion_loot_value" IS NULL
          AND "battle_reports"."dominion_attacker_loss_value" IS NULL
          AND "battle_reports"."dominion_defender_loss_value" IS NULL
          AND "battle_reports"."dominion_raw_exchange" IS NULL)
        OR ("battle_reports"."dominion_eligible" = false
          AND "battle_reports"."target_kind" = 'PLAYER'
          AND "battle_reports"."dominion_swing" = 0
          AND "battle_reports"."dominion_rule_version" IS NULL
          AND "battle_reports"."dominion_loot_value" IS NULL
          AND "battle_reports"."dominion_attacker_loss_value" IS NULL
          AND "battle_reports"."dominion_defender_loss_value" IS NULL
          AND "battle_reports"."dominion_raw_exchange" IS NULL)
        OR ("battle_reports"."dominion_eligible" = true
          AND "battle_reports"."target_kind" = 'PLAYER'
          AND "battle_reports"."dominion_rule_version" > 0
          AND "battle_reports"."dominion_loot_value" >= 0
          AND "battle_reports"."dominion_attacker_loss_value" >= 0
          AND "battle_reports"."dominion_defender_loss_value" >= 0
          AND "battle_reports"."dominion_raw_exchange" = "battle_reports"."dominion_loot_value"
            + "battle_reports"."dominion_defender_loss_value" - "battle_reports"."dominion_attacker_loss_value"
          AND "battle_reports"."dominion_swing" IS NOT NULL
          AND ("battle_reports"."dominion_rule_version" < 7
            OR "battle_reports"."clan_war_operation_id" IS NOT NULL
            OR "battle_reports"."dominion_raw_exchange" = "battle_reports"."dominion_swing")));
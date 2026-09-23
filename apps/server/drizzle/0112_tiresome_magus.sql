-- Taktik geri çekilme (2026-09-23): what the defending ships did on a raid that
-- outmatched them three to one. Null on every report written before the rule, and
-- on every battle the rule never came into. Additive; ruleset 11 seasons write it.
ALTER TABLE "battle_reports" ADD COLUMN "fleet_escape" jsonb;

-- 2026-09-19: pirates spawn per active commander, hour by hour (ruleset 9). The
-- hour's pirate lane is written once, beside its rock lanes, and every read derives
-- the same pirates from it. Null for a season on the derived per-seat lane.
ALTER TABLE "asteroid_spawn_hours" ADD COLUMN "pirate_lane" jsonb;

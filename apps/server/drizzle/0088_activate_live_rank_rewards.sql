-- The rank-reward schema shipped while a production cycle was already live.
-- Migration 0084 correctly left every existing cycle at program version 0, but
-- final Dominion is fully available for a live season and needs no partial
-- telemetry backfill. Activate v1 only for unfinished competitive cycles. A
-- WAITING season can share that cycle; the season endpoint and freeze handler
-- both exclude WAITING by shard role, so Silent Space still promises and earns
-- nothing.
UPDATE "season_cycles" AS "cycle"
SET "reward_program_version" = 1
WHERE "cycle"."reward_program_version" = 0
  AND EXISTS (
    SELECT 1
    FROM "seasons" AS "season"
    INNER JOIN "shards" AS "shard" ON "shard"."id" = "season"."shard_id"
    WHERE "season"."cycle_id" = "cycle"."id"
      AND "season"."status" IN ('live', 'pending')
      AND "shard"."role" = 'MAIN'
  );

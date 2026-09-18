-- 2026-09-18: the thousand-seat galaxy (radius 2000 -> 3000). Ships at a season
-- boundary; nothing here moves a world.
--
-- 1. New galaxies open at SERVERS.capacity. `test/servers.test.ts` holds the two
--    together.
ALTER TABLE "shards" ALTER COLUMN "player_cap" SET DEFAULT 1000;
--> statement-breakpoint
-- 2. Both sensor ladders took x1.5 with the radius. An open epoch keeps the reach
--    stored when it began (see 0045), so close each one now and reopen it at the
--    same post on the new ladder. Every telescope rung of the old ladder is exactly
--    two thirds of the new one and the naked-eye floor (750) did not move, so the
--    stored reach is rescaled rather than re-derived from instruments and faults.
--    `test/thousand-seats-migration.test.ts` holds this to the rules.
UPDATE "sensor_epochs"
SET "reach" = "reach" * 1.5
WHERE "ends_at" IS NULL AND "starts_at" >= now() AND "reach" > 750;
--> statement-breakpoint
WITH "closed" AS (
  UPDATE "sensor_epochs"
  SET "ends_at" = now()
  WHERE "ends_at" IS NULL AND "starts_at" < now()
  RETURNING "season_id", "player_id", "planet_id", "x", "y", "z", "reach"
)
INSERT INTO "sensor_epochs" ("season_id", "player_id", "planet_id", "x", "y", "z", "reach", "starts_at")
SELECT "season_id", "player_id", "planet_id", "x", "y", "z",
  CASE WHEN "reach" > 750 THEN "reach" * 1.5 ELSE "reach" END, now()
FROM "closed";

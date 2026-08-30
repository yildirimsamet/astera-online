/*
 * Radius changes must cut over durable asteroid-discovery history too. Runtime
 * reads use the rules table immediately, but an already-open sensor epoch keeps
 * the reach stored when it began. Close that historical interval at deployment
 * and open one current interval with the new Telescope/naked-eye ladder.
 */
DELETE FROM "sensor_epochs"
WHERE "ends_at" IS NULL AND "starts_at" >= now();
--> statement-breakpoint
UPDATE "sensor_epochs"
SET "ends_at" = now()
WHERE "ends_at" IS NULL;
--> statement-breakpoint
WITH "core_levels" AS (
	SELECT "planet_id", "level"
	FROM "buildings"
	WHERE "type" = 'CORE'
),
"ranked_orbit" AS (
	SELECT
		"s"."planet_id",
		"s"."type",
		row_number() OVER (PARTITION BY "s"."planet_id" ORDER BY "s"."slot") AS "orbit_rank"
	FROM "satellites" "s"
	WHERE "s"."type" NOT IN ('TELESCOPE', 'RADAR', 'AEGIS', 'VEIL')
),
"active_uplinks" AS (
	SELECT DISTINCT "o"."planet_id"
	FROM "ranked_orbit" "o"
	JOIN "core_levels" "c" ON "c"."planet_id" = "o"."planet_id"
	WHERE "o"."type" = 'UPLINK'
		AND "o"."orbit_rank" <= CASE
			WHEN "c"."level" >= 9 THEN 4
			WHEN "c"."level" >= 5 THEN 3
			WHEN "c"."level" >= 3 THEN 2
			WHEN "c"."level" >= 1 THEN 1
			ELSE 0
		END
),
"telescope_levels" AS (
	SELECT "planet_id", max("level") AS "level"
	FROM "satellites"
	WHERE "type" = 'TELESCOPE'
	GROUP BY "planet_id"
),
"effective_telescope" AS (
	SELECT
		"p"."id" AS "planet_id",
		CASE
			WHEN "u"."planet_id" IS NULL THEN 0
			ELSE least(coalesce("t"."level", 0), coalesce("c"."level", 0))
		END AS "level"
	FROM "planets" "p"
	LEFT JOIN "core_levels" "c" ON "c"."planet_id" = "p"."id"
	LEFT JOIN "active_uplinks" "u" ON "u"."planet_id" = "p"."id"
	LEFT JOIN "telescope_levels" "t" ON "t"."planet_id" = "p"."id"
)
INSERT INTO "sensor_epochs" (
	"season_id", "player_id", "planet_id", "x", "y", "z", "reach", "starts_at"
)
SELECT
	"p"."season_id",
	"p"."player_id",
	"p"."id",
	"p"."x",
	"p"."y",
	"p"."z",
	CASE
		WHEN "e"."level" >= 5 THEN 1600
		WHEN "e"."level" = 4 THEN 1450
		WHEN "e"."level" = 3 THEN 1250
		WHEN "e"."level" = 2 THEN 1150
		WHEN "e"."level" = 1 THEN 950
		ELSE 750
	END,
	now()
FROM "planets" "p"
JOIN "seasons" "season" ON "season"."id" = "p"."season_id"
JOIN "effective_telescope" "e" ON "e"."planet_id" = "p"."id"
WHERE "p"."player_id" IS NOT NULL
	AND "season"."status" = 'live';

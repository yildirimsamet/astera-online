-- 2026-09-18: the Hangar returns (reverses 0068_drop_hangar). Every world is handed
-- the rung its Command Core already opens: Core 4/7/10/13/16 open rungs 2-6, and
-- rungs 7-10 are only ever bought. Must match `hangarSeedLevel` in @astera/rules;
-- `test/hangar-migration.test.ts` holds the two together. A Hangar row already
-- present (a world registered after deploy) is left alone.
INSERT INTO "buildings" ("planet_id", "type", "level")
SELECT "planet_id", 'HANGAR',
  CASE
    WHEN "level" >= 16 THEN 6
    WHEN "level" >= 13 THEN 5
    WHEN "level" >= 10 THEN 4
    WHEN "level" >= 7 THEN 3
    WHEN "level" >= 4 THEN 2
    ELSE 1
  END
FROM "buildings"
WHERE "type" = 'CORE' AND "level" >= 1
ON CONFLICT ("planet_id", "type") DO NOTHING;

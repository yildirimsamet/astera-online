ALTER TABLE "hp_radiation_sources" ADD COLUMN "radiation_level" integer;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "monument_radiation_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hp_radiation_sources" ADD CONSTRAINT "hp_radiation_sources_level_check" CHECK ("hp_radiation_sources"."radiation_level" IS NULL OR ("hp_radiation_sources"."radiation_level" IN (1, 2) AND "hp_radiation_sources"."mode" = 'EMIT'));--> statement-breakpoint
-- Identify only the authored Easy/Hard base sources. Rates and time windows stay unchanged.
UPDATE "hp_radiation_sources" AS source
SET "radiation_level" = CASE monument."difficulty" WHEN 'EASY' THEN 1 ELSE 2 END
FROM "monuments" AS monument
WHERE source."season_id" = monument."season_id"
  AND source."anchor_kind" = 'MONUMENT' AND source."anchor_id" = monument."id"
  AND source."mode" = 'EMIT'
  AND source."label" = 'Monument ' || monument."ordinal"::text || ' cloud'
  AND ((monument."difficulty" = 'EASY' AND source."intensity_hp_per_minute" = 2)
    OR (monument."difficulty" = 'HARD' AND source."intensity_hp_per_minute" = 5));

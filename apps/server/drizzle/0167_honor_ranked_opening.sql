-- Retain the observation epoch separately from the announced competitive race.
ALTER TABLE "honor_seasons" ADD COLUMN "ranked_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "honor_seasons" SET "ranked_at" = "created_at" WHERE "mode" = 'ACTIVE';
--> statement-breakpoint
ALTER TABLE "honor_seasons" ADD CONSTRAINT "honor_seasons_ranked_boundary_check"
  CHECK ("ranked_at" IS NULL OR "ranked_at" >= "created_at");
--> statement-breakpoint
-- Immutable trial evidence survives opening, but never enters the ranked replay.
ALTER TABLE "honor_events" ADD COLUMN "ranked" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
UPDATE "honor_events" e SET "ranked" = false
  FROM "honor_seasons" s WHERE e."season_id" = s."season_id" AND s."mode" = 'SHADOW';

ALTER TABLE "mining_runs" ADD COLUMN "recalled_at" timestamp with time zone;--> statement-breakpoint
UPDATE "mining_runs" AS "run"
SET "owner_player_id" = "planet"."player_id"
FROM "planets" AS "planet"
WHERE "run"."planet_id" = "planet"."id"
  AND "run"."owner_player_id" IS NULL
  AND "planet"."player_id" IS NOT NULL;

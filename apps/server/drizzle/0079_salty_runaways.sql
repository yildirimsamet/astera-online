ALTER TABLE "season_cycles" ADD COLUMN "ordinal" integer;--> statement-breakpoint
WITH ranked AS (
  SELECT "id", row_number() OVER (
    ORDER BY "starts_at" ASC, "ends_at" ASC, "id" ASC
  )::integer AS "ordinal"
  FROM "season_cycles"
)
UPDATE "season_cycles"
SET "ordinal" = ranked."ordinal"
FROM ranked
WHERE "season_cycles"."id" = ranked."id";--> statement-breakpoint
ALTER TABLE "season_cycles" ALTER COLUMN "ordinal" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "season_results" ADD COLUMN "public_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "season_cycles_ordinal_idx" ON "season_cycles" USING btree ("ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "season_results_public_idx" ON "season_results" USING btree ("public_id");

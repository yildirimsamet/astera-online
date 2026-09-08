CREATE TABLE "season_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	CONSTRAINT "season_cycles_period_check" CHECK ("season_cycles"."ends_at" > "season_cycles"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "home_shard_id" uuid;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "placement_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "main_entered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "cycle_id" uuid;--> statement-breakpoint
-- Stable legacy grouping: existing season IDs choose the cycle ID; no clock shifts.
INSERT INTO "season_cycles" ("id", "starts_at", "ends_at")
SELECT min("id"::text)::uuid, "starts_at", "ends_at"
FROM "seasons" GROUP BY "starts_at", "ends_at";--> statement-breakpoint
UPDATE "seasons" AS s SET "cycle_id" = c."id"
FROM "season_cycles" AS c
WHERE s."starts_at" = c."starts_at" AND s."ends_at" = c."ends_at";--> statement-breakpoint
ALTER TABLE "seasons" ALTER COLUMN "cycle_id" SET NOT NULL;--> statement-breakpoint
UPDATE "players" AS p SET "home_shard_id" = s."shard_id", "main_entered_at" = p."joined_at"
FROM "seasons" AS s WHERE p."season_id" = s."id";--> statement-breakpoint
ALTER TABLE "shards" ADD COLUMN "role" text DEFAULT 'MAIN' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "season_cycles_period_idx" ON "season_cycles" USING btree ("starts_at","ends_at");--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_home_shard_id_shards_id_fk" FOREIGN KEY ("home_shard_id") REFERENCES "public"."shards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_cycle_id_season_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."season_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shards" ADD CONSTRAINT "shards_role_check" CHECK ("shards"."role" IN ('MAIN', 'WAITING'));
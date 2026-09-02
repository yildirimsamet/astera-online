CREATE TYPE "public"."pirate_raid_status" AS ENUM('outbound', 'returning', 'done');--> statement-breakpoint
CREATE TABLE "pirate_raids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"planet_id" uuid NOT NULL,
	"pirate_index" integer NOT NULL,
	"status" "pirate_raid_status" DEFAULT 'outbound' NOT NULL,
	"fleet" jsonb NOT NULL,
	"tech" jsonb,
	"intercept_x" real NOT NULL,
	"intercept_y" real NOT NULL,
	"intercept_z" real NOT NULL,
	"depart_at" timestamp with time zone NOT NULL,
	"arrive_at" timestamp with time zone NOT NULL,
	"home_at" timestamp with time zone,
	"loot" jsonb,
	"captured_hull" text
);
--> statement-breakpoint
ALTER TABLE "battle_reports" ALTER COLUMN "mission_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "battle_reports" ALTER COLUMN "target_planet_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "pirate_raid_id" uuid;--> statement-breakpoint
ALTER TABLE "pirate_raids" ADD CONSTRAINT "pirate_raids_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pirate_raids" ADD CONSTRAINT "pirate_raids_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pirate_raids_planet_idx" ON "pirate_raids" USING btree ("planet_id","status");--> statement-breakpoint
CREATE INDEX "pirate_raids_season_idx" ON "pirate_raids" USING btree ("season_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "pirate_raids_planet_target_idx" ON "pirate_raids" USING btree ("planet_id","pirate_index") WHERE status <> 'done';--> statement-breakpoint
ALTER TABLE "battle_reports" ADD CONSTRAINT "battle_reports_pirate_raid_id_pirate_raids_id_fk" FOREIGN KEY ("pirate_raid_id") REFERENCES "public"."pirate_raids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reports_pirate_raid_idx" ON "battle_reports" USING btree ("pirate_raid_id");--> statement-breakpoint
ALTER TABLE "battle_reports" ADD CONSTRAINT "battle_reports_one_target" CHECK (("battle_reports"."target_kind" IN ('PLAYER', 'NEUTRAL')
          AND "battle_reports"."mission_id" IS NOT NULL
          AND "battle_reports"."target_planet_id" IS NOT NULL
          AND "battle_reports"."pirate_raid_id" IS NULL)
        OR ("battle_reports"."target_kind" = 'PIRATE'
          AND "battle_reports"."pirate_raid_id" IS NOT NULL
          AND "battle_reports"."mission_id" IS NULL
          AND "battle_reports"."target_planet_id" IS NULL));
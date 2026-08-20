CREATE TYPE "public"."mining_status" AS ENUM('outbound', 'returning', 'done');--> statement-breakpoint
CREATE TABLE "asteroid_claims" (
	"season_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"ore_taken" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "asteroid_claims_season_id_index_pk" PRIMARY KEY("season_id","index")
);
--> statement-breakpoint
CREATE TABLE "mining_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"planet_id" uuid NOT NULL,
	"asteroid_index" integer NOT NULL,
	"status" "mining_status" DEFAULT 'outbound' NOT NULL,
	"craft" integer NOT NULL,
	"hold_each" real NOT NULL,
	"intercept_x" real NOT NULL,
	"intercept_y" real NOT NULL,
	"intercept_z" real NOT NULL,
	"depart_at" timestamp with time zone NOT NULL,
	"arrive_at" timestamp with time zone NOT NULL,
	"home_at" timestamp with time zone,
	"mined_alloy" real DEFAULT 0 NOT NULL,
	"mined_crystal" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asteroid_claims" ADD CONSTRAINT "asteroid_claims_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mining_runs" ADD CONSTRAINT "mining_runs_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mining_runs" ADD CONSTRAINT "mining_runs_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mining_planet_idx" ON "mining_runs" USING btree ("planet_id","status");--> statement-breakpoint
CREATE INDEX "mining_season_idx" ON "mining_runs" USING btree ("season_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "mining_planet_rock_idx" ON "mining_runs" USING btree ("planet_id","asteroid_index") WHERE status <> 'done';
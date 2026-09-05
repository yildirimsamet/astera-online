CREATE TYPE "public"."trade_run_status" AS ENUM('outbound', 'returning', 'done');--> statement-breakpoint
CREATE TABLE "trade_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"planet_id" uuid NOT NULL,
	"owner_player_id" uuid NOT NULL,
	"status" "trade_run_status" DEFAULT 'outbound' NOT NULL,
	"fleet" jsonb NOT NULL,
	"give" jsonb NOT NULL,
	"want" jsonb NOT NULL,
	"rate" jsonb NOT NULL,
	"intercept_x" real NOT NULL,
	"intercept_y" real NOT NULL,
	"intercept_z" real NOT NULL,
	"depart_at" timestamp with time zone NOT NULL,
	"arrive_at" timestamp with time zone NOT NULL,
	"home_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "trade_runs" ADD CONSTRAINT "trade_runs_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_runs" ADD CONSTRAINT "trade_runs_occurrence_id_galaxy_event_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."galaxy_event_occurrences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_runs" ADD CONSTRAINT "trade_runs_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_runs" ADD CONSTRAINT "trade_runs_owner_player_id_players_id_fk" FOREIGN KEY ("owner_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_runs_planet_idx" ON "trade_runs" USING btree ("planet_id","status");--> statement-breakpoint
CREATE INDEX "trade_runs_season_idx" ON "trade_runs" USING btree ("season_id","status");
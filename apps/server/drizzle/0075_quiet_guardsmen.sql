CREATE TYPE "public"."intergalactic_convoy_run_status" AS ENUM('outbound', 'returning', 'done');--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'convoy_arrival';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'convoy_return';--> statement-breakpoint
ALTER TYPE "public"."galaxy_event_occurrence_kind" ADD VALUE 'INTERGALACTIC_CONVOY';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'convoy_result';--> statement-breakpoint
CREATE TABLE "intergalactic_convoy_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"planet_id" uuid NOT NULL,
	"owner_player_id" uuid NOT NULL,
	"status" "intergalactic_convoy_run_status" DEFAULT 'outbound' NOT NULL,
	"fleet" jsonb NOT NULL,
	"tech" jsonb NOT NULL,
	"intercept_x" double precision NOT NULL,
	"intercept_y" double precision NOT NULL,
	"intercept_z" double precision NOT NULL,
	"engagement_end_x" double precision NOT NULL,
	"engagement_end_y" double precision NOT NULL,
	"engagement_end_z" double precision NOT NULL,
	"return_x" double precision NOT NULL,
	"return_y" double precision NOT NULL,
	"return_z" double precision NOT NULL,
	"depart_at" timestamp with time zone NOT NULL,
	"arrive_at" timestamp with time zone NOT NULL,
	"engagement_ends_at" timestamp with time zone NOT NULL,
	"home_at" timestamp with time zone NOT NULL,
	"production_cap" jsonb NOT NULL,
	"resource_quality_factor" double precision NOT NULL,
	"ship_quality_factor" double precision NOT NULL,
	"quoted_resource_reward" jsonb NOT NULL,
	"resource_reward" jsonb,
	"awarded_fleet" jsonb,
	CONSTRAINT "intergalactic_convoy_runs_quality_check" CHECK ("intergalactic_convoy_runs"."resource_quality_factor" BETWEEN 0 AND 1
      AND "intergalactic_convoy_runs"."ship_quality_factor" BETWEEN 0 AND 1),
	CONSTRAINT "intergalactic_convoy_runs_time_order_check" CHECK ("intergalactic_convoy_runs"."depart_at" <= "intergalactic_convoy_runs"."arrive_at"
      AND "intergalactic_convoy_runs"."arrive_at" < "intergalactic_convoy_runs"."engagement_ends_at"
      AND "intergalactic_convoy_runs"."engagement_ends_at" = "intergalactic_convoy_runs"."arrive_at" + INTERVAL '5 seconds'
      AND "intergalactic_convoy_runs"."engagement_ends_at" <= "intergalactic_convoy_runs"."home_at"),
	CONSTRAINT "intergalactic_convoy_runs_coordinates_check" CHECK ("intergalactic_convoy_runs"."intercept_x" > '-Infinity'::double precision
      AND "intergalactic_convoy_runs"."intercept_x" < 'Infinity'::double precision
      AND "intergalactic_convoy_runs"."intercept_y" > '-Infinity'::double precision
      AND "intergalactic_convoy_runs"."intercept_y" < 'Infinity'::double precision
      AND "intergalactic_convoy_runs"."intercept_z" > '-Infinity'::double precision
      AND "intergalactic_convoy_runs"."intercept_z" < 'Infinity'::double precision
      AND "intergalactic_convoy_runs"."engagement_end_x" > '-Infinity'::double precision
      AND "intergalactic_convoy_runs"."engagement_end_x" < 'Infinity'::double precision
      AND "intergalactic_convoy_runs"."engagement_end_y" > '-Infinity'::double precision
      AND "intergalactic_convoy_runs"."engagement_end_y" < 'Infinity'::double precision
      AND "intergalactic_convoy_runs"."engagement_end_z" > '-Infinity'::double precision
      AND "intergalactic_convoy_runs"."engagement_end_z" < 'Infinity'::double precision
      AND "intergalactic_convoy_runs"."return_x" > '-Infinity'::double precision
      AND "intergalactic_convoy_runs"."return_x" < 'Infinity'::double precision
      AND "intergalactic_convoy_runs"."return_y" > '-Infinity'::double precision
      AND "intergalactic_convoy_runs"."return_y" < 'Infinity'::double precision
      AND "intergalactic_convoy_runs"."return_z" > '-Infinity'::double precision
      AND "intergalactic_convoy_runs"."return_z" < 'Infinity'::double precision),
	CONSTRAINT "intergalactic_convoy_runs_reward_state_check" CHECK (("intergalactic_convoy_runs"."status" = 'outbound'
          AND "intergalactic_convoy_runs"."resource_reward" IS NULL
          AND "intergalactic_convoy_runs"."awarded_fleet" IS NULL)
      OR ("intergalactic_convoy_runs"."status" <> 'outbound'
          AND "intergalactic_convoy_runs"."resource_reward" IS NOT NULL
          AND "intergalactic_convoy_runs"."awarded_fleet" IS NOT NULL)),
	CONSTRAINT "intergalactic_convoy_runs_production_cap_check" CHECK (COALESCE(("intergalactic_convoy_runs"."production_cap"->>'alloy')::numeric >= 0, false)
      AND COALESCE(("intergalactic_convoy_runs"."production_cap"->>'crystal')::numeric >= 0, false)
      AND COALESCE(("intergalactic_convoy_runs"."production_cap"->>'deuterium')::numeric >= 0, false)),
	CONSTRAINT "intergalactic_convoy_runs_quoted_reward_check" CHECK (COALESCE(("intergalactic_convoy_runs"."quoted_resource_reward"->>'alloy')::numeric >= 0, false)
      AND COALESCE(("intergalactic_convoy_runs"."quoted_resource_reward"->>'crystal')::numeric >= 0, false)
      AND COALESCE(("intergalactic_convoy_runs"."quoted_resource_reward"->>'deuterium')::numeric >= 0, false)),
	CONSTRAINT "intergalactic_convoy_runs_resource_reward_check" CHECK ("intergalactic_convoy_runs"."resource_reward" IS NULL OR (
      COALESCE(("intergalactic_convoy_runs"."resource_reward"->>'alloy')::numeric >= 0, false)
      AND COALESCE(("intergalactic_convoy_runs"."resource_reward"->>'crystal')::numeric >= 0, false)
      AND COALESCE(("intergalactic_convoy_runs"."resource_reward"->>'deuterium')::numeric >= 0, false)))
);
--> statement-breakpoint
ALTER TABLE "intergalactic_convoy_runs" ADD CONSTRAINT "intergalactic_convoy_runs_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intergalactic_convoy_runs" ADD CONSTRAINT "intergalactic_convoy_runs_occurrence_id_galaxy_event_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."galaxy_event_occurrences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intergalactic_convoy_runs" ADD CONSTRAINT "intergalactic_convoy_runs_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intergalactic_convoy_runs" ADD CONSTRAINT "intergalactic_convoy_runs_owner_player_id_players_id_fk" FOREIGN KEY ("owner_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intergalactic_convoy_runs_season_status_idx" ON "intergalactic_convoy_runs" USING btree ("season_id","status");--> statement-breakpoint
CREATE INDEX "intergalactic_convoy_runs_owner_status_idx" ON "intergalactic_convoy_runs" USING btree ("owner_player_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "intergalactic_convoy_runs_planet_active_idx" ON "intergalactic_convoy_runs" USING btree ("planet_id") WHERE "intergalactic_convoy_runs"."status" <> 'done';--> statement-breakpoint
CREATE UNIQUE INDEX "intergalactic_convoy_runs_planet_occurrence_idx" ON "intergalactic_convoy_runs" USING btree ("planet_id","occurrence_id");

ALTER TYPE "public"."event_kind" ADD VALUE 'probe_defence';--> statement-breakpoint
CREATE TABLE "probe_batteries" (
	"planet_id" uuid PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ready_at" timestamp with time zone NOT NULL,
	"charges" integer NOT NULL,
	"charged_at" timestamp with time zone NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"upgrade_level" integer,
	"upgrade_started_at" timestamp with time zone,
	"upgrade_ready_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "probe_shots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"mission_id" uuid NOT NULL,
	"attacker_player_id" uuid NOT NULL,
	"defender_player_id" uuid NOT NULL,
	"target_planet_id" uuid NOT NULL,
	"shot_at" timestamp with time zone NOT NULL,
	"x" real NOT NULL,
	"y" real NOT NULL,
	"z" real NOT NULL,
	"fired_at" timestamp with time zone NOT NULL,
	"from_x" real NOT NULL,
	"from_y" real NOT NULL,
	"from_z" real NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scan_events" ADD COLUMN "shot_down" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "probe_batteries" ADD CONSTRAINT "probe_batteries_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probe_shots" ADD CONSTRAINT "probe_shots_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probe_shots" ADD CONSTRAINT "probe_shots_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probe_shots" ADD CONSTRAINT "probe_shots_attacker_player_id_players_id_fk" FOREIGN KEY ("attacker_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probe_shots" ADD CONSTRAINT "probe_shots_defender_player_id_players_id_fk" FOREIGN KEY ("defender_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probe_shots" ADD CONSTRAINT "probe_shots_target_planet_id_planets_id_fk" FOREIGN KEY ("target_planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "probe_shots_mission_idx" ON "probe_shots" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "probe_shots_attacker_idx" ON "probe_shots" USING btree ("attacker_player_id","shot_at");--> statement-breakpoint
CREATE INDEX "probe_shots_target_idx" ON "probe_shots" USING btree ("target_planet_id","shot_at");--> statement-breakpoint
CREATE INDEX "probe_shots_defender_idx" ON "probe_shots" USING btree ("defender_player_id");--> statement-breakpoint
CREATE INDEX "probe_shots_season_idx" ON "probe_shots" USING btree ("season_id","shot_at");
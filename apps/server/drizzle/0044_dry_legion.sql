ALTER TYPE "public"."event_kind" ADD VALUE 'strategic_intercept_impact';--> statement-breakpoint
CREATE TABLE "strategic_interceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"mission_id" uuid NOT NULL,
	"attacker_player_id" uuid NOT NULL,
	"defender_player_id" uuid NOT NULL,
	"target_planet_id" uuid NOT NULL,
	"charge_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"launch_at" timestamp with time zone NOT NULL,
	"impact_at" timestamp with time zone NOT NULL,
	"launch_x" real NOT NULL,
	"launch_y" real NOT NULL,
	"launch_z" real NOT NULL,
	"death_star_from_x" real NOT NULL,
	"death_star_from_y" real NOT NULL,
	"death_star_from_z" real NOT NULL,
	"collision_x" real NOT NULL,
	"collision_y" real NOT NULL,
	"collision_z" real NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "strategic_interceptions_trigger_check" CHECK ("strategic_interceptions"."trigger" IN ('RADAR', 'TELESCOPE')),
	CONSTRAINT "strategic_interceptions_window_check" CHECK ("strategic_interceptions"."impact_at" > "strategic_interceptions"."launch_at")
);
--> statement-breakpoint
ALTER TABLE "strategic_assets" DROP CONSTRAINT "strategic_assets_type_check";--> statement-breakpoint
ALTER TABLE "strategic_impacts" ADD COLUMN "destroyed_resources" jsonb DEFAULT '{"alloy":0,"crystal":0,"deuterium":0}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "strategic_impacts" ADD COLUMN "level_changes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "strategic_impacts" ADD COLUMN "destroyed_orders" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "strategic_impacts" ADD COLUMN "shield_destroyed" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "strategic_interceptions" ADD CONSTRAINT "strategic_interceptions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_interceptions" ADD CONSTRAINT "strategic_interceptions_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_interceptions" ADD CONSTRAINT "strategic_interceptions_attacker_player_id_players_id_fk" FOREIGN KEY ("attacker_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_interceptions" ADD CONSTRAINT "strategic_interceptions_defender_player_id_players_id_fk" FOREIGN KEY ("defender_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_interceptions" ADD CONSTRAINT "strategic_interceptions_target_planet_id_planets_id_fk" FOREIGN KEY ("target_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_interceptions" ADD CONSTRAINT "strategic_interceptions_charge_id_strategic_assets_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."strategic_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "strategic_interceptions_mission_idx" ON "strategic_interceptions" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "strategic_interceptions_season_time_idx" ON "strategic_interceptions" USING btree ("season_id","launch_at","impact_at");--> statement-breakpoint
CREATE INDEX "strategic_interceptions_defender_idx" ON "strategic_interceptions" USING btree ("defender_player_id","launch_at");--> statement-breakpoint
ALTER TABLE "strategic_assets" ADD CONSTRAINT "strategic_assets_type_check" CHECK ("strategic_assets"."type" IN ('DEATH_STAR', 'INTERCEPTOR'));
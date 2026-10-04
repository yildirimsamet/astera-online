-- Expand-only monument persistence. No existing season/ruleset or balance is changed.
-- The composite target-season index must exist before its foreign key is added.
CREATE TABLE "hp_radiation_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"anchor_kind" text NOT NULL,
	"anchor_id" uuid,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"z" double precision NOT NULL,
	"radius" double precision NOT NULL,
	"intensity_hp_per_minute" double precision NOT NULL,
	"mode" text NOT NULL,
	"active_from" timestamp with time zone NOT NULL,
	"active_until" timestamp with time zone,
	"label" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hp_radiation_sources_amounts_check" CHECK ("hp_radiation_sources"."radius" > 0 AND "hp_radiation_sources"."radius" < 'Infinity'::float8
    AND "hp_radiation_sources"."intensity_hp_per_minute" >= 0 AND "hp_radiation_sources"."intensity_hp_per_minute" < 'Infinity'::float8),
	CONSTRAINT "hp_radiation_sources_position_check" CHECK ("hp_radiation_sources"."x" > '-Infinity'::float8 AND "hp_radiation_sources"."x" < 'Infinity'::float8
    AND "hp_radiation_sources"."y" > '-Infinity'::float8 AND "hp_radiation_sources"."y" < 'Infinity'::float8
    AND "hp_radiation_sources"."z" > '-Infinity'::float8 AND "hp_radiation_sources"."z" < 'Infinity'::float8),
	CONSTRAINT "hp_radiation_sources_mode_check" CHECK ("hp_radiation_sources"."mode" IN ('EMIT', 'SHELTER')),
	CONSTRAINT "hp_radiation_sources_anchor_check" CHECK (("hp_radiation_sources"."anchor_kind" = 'ZONE' AND "hp_radiation_sources"."anchor_id" IS NULL)
    OR ("hp_radiation_sources"."anchor_kind" IN ('PLANET', 'MONUMENT') AND "hp_radiation_sources"."anchor_id" IS NOT NULL)),
	CONSTRAINT "hp_radiation_sources_window_check" CHECK ("hp_radiation_sources"."active_until" IS NULL OR "hp_radiation_sources"."active_until" >= "hp_radiation_sources"."active_from")
);
--> statement-breakpoint
CREATE TABLE "monument_ship_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wave_id" uuid NOT NULL,
	"hull" text NOT NULL,
	"count" integer NOT NULL,
	"damage_bp" integer NOT NULL,
	"remainder_bp" double precision NOT NULL,
	"deuterium" double precision NOT NULL,
	CONSTRAINT "monument_ship_lots_count_check" CHECK ("monument_ship_lots"."count" > 0),
	CONSTRAINT "monument_ship_lots_damage_check" CHECK ("monument_ship_lots"."damage_bp" BETWEEN 0 AND 9999
    AND "monument_ship_lots"."remainder_bp" >= 0 AND "monument_ship_lots"."remainder_bp" < 1),
	CONSTRAINT "monument_ship_lots_cargo_check" CHECK ("monument_ship_lots"."deuterium" >= 0 AND "monument_ship_lots"."deuterium" < 'Infinity'::float8
    AND ("monument_ship_lots"."deuterium" = 0 OR "monument_ship_lots"."hull" IN ('COURIER', 'WAYFARER', 'ATLAS', 'ARGOSY'))),
	CONSTRAINT "monument_ship_lots_hull_check" CHECK ("monument_ship_lots"."hull" IN ('DART', 'PIKE', 'RAMPART', 'WARDEN', 'COURIER',
    'VIPER', 'TALON', 'STRONGHOLD', 'SENTINEL', 'WAYFARER', 'TEMPEST', 'BALLISTA', 'LEVIATHAN',
    'PRAETORIAN', 'ATLAS', 'NULLIFIER', 'GARBAGE_COLLECTOR', 'CATACLYSM', 'CORSAIR', 'CITADEL', 'PALADIN', 'ARGOSY'))
);
--> statement-breakpoint
CREATE TABLE "monument_waves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"monument_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"origin_planet_id" uuid NOT NULL,
	"root_wave_id" uuid,
	"joint_contribution_id" uuid,
	"unit_location" text NOT NULL,
	"purpose" text NOT NULL,
	"sent_fleet" jsonb NOT NULL,
	"tech" jsonb NOT NULL,
	"route" jsonb NOT NULL,
	"reserved_bulk" integer DEFAULT 0 NOT NULL,
	"fuel_paid" double precision NOT NULL,
	"status" text DEFAULT 'OUTBOUND' NOT NULL,
	"return_reason" text,
	"sent_at" timestamp with time zone NOT NULL,
	"arrive_at" timestamp with time zone,
	"held_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"radiation_settled_at" timestamp with time zone NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "monument_waves_location_check" CHECK ("monument_waves"."unit_location" = 'monument:' || "monument_waves"."id"::text),
	CONSTRAINT "monument_waves_purpose_check" CHECK ("monument_waves"."purpose" IN ('ATTACK', 'REINFORCE')),
	CONSTRAINT "monument_waves_status_check" CHECK ("monument_waves"."status" IN ('OUTBOUND', 'HOLD', 'RETURNING', 'HOME', 'LOST')),
	CONSTRAINT "monument_waves_reason_check" CHECK ("monument_waves"."return_reason" IS NULL OR "monument_waves"."return_reason"
    IN ('RECALLED', 'CAPACITY', 'MEMBERSHIP', 'DEFEAT', 'WORLD_CHANGED', 'FREEZE')),
	CONSTRAINT "monument_waves_amounts_check" CHECK ("monument_waves"."reserved_bulk" >= 0 AND "monument_waves"."generation" >= 0
    AND "monument_waves"."fuel_paid" >= 0 AND "monument_waves"."fuel_paid" < 'Infinity'::float8),
	CONSTRAINT "monument_waves_lifecycle_check" CHECK (("monument_waves"."status" <> 'HOLD' OR "monument_waves"."held_at" IS NOT NULL)
    AND ("monument_waves"."status" NOT IN ('OUTBOUND', 'RETURNING') OR "monument_waves"."arrive_at" IS NOT NULL)
    AND ("monument_waves"."status" <> 'RETURNING' OR "monument_waves"."return_reason" IS NOT NULL)
    AND ("monument_waves"."status" NOT IN ('HOME', 'LOST') OR "monument_waves"."resolved_at" IS NOT NULL)
    AND ("monument_waves"."arrive_at" IS NULL OR "monument_waves"."arrive_at" >= "monument_waves"."sent_at")
    AND ("monument_waves"."held_at" IS NULL OR "monument_waves"."held_at" >= "monument_waves"."sent_at")
    AND "monument_waves"."radiation_settled_at" >= "monument_waves"."sent_at")
);
--> statement-breakpoint
CREATE TABLE "monuments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"z" double precision NOT NULL,
	"capacity" integer NOT NULL,
	"production_per_minute" double precision NOT NULL,
	"controller_player_id" uuid,
	"controller_clan_id" uuid,
	"garrison" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settled_at" timestamp with time zone NOT NULL,
	"empty_since" timestamp with time zone,
	"generation" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "monuments_ordinal_check" CHECK ("monuments"."ordinal" BETWEEN 1 AND 5),
	CONSTRAINT "monuments_amounts_check" CHECK ("monuments"."capacity" > 0 AND "monuments"."generation" >= 0
    AND "monuments"."production_per_minute" >= 0 AND "monuments"."production_per_minute" < 'Infinity'::float8),
	CONSTRAINT "monuments_position_check" CHECK ("monuments"."x" > '-Infinity'::float8 AND "monuments"."x" < 'Infinity'::float8
    AND "monuments"."y" > '-Infinity'::float8 AND "monuments"."y" < 'Infinity'::float8
    AND "monuments"."z" > '-Infinity'::float8 AND "monuments"."z" < 'Infinity'::float8),
	CONSTRAINT "monuments_controller_check" CHECK ("monuments"."controller_player_id" IS NULL OR "monuments"."controller_clan_id" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "hp_radiation_sources" ADD CONSTRAINT "hp_radiation_sources_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monument_ship_lots" ADD CONSTRAINT "monument_ship_lots_wave_id_monument_waves_id_fk" FOREIGN KEY ("wave_id") REFERENCES "public"."monument_waves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monument_waves" ADD CONSTRAINT "monument_waves_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monument_waves" ADD CONSTRAINT "monument_waves_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monument_waves" ADD CONSTRAINT "monument_waves_origin_planet_id_planets_id_fk" FOREIGN KEY ("origin_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monument_waves" ADD CONSTRAINT "monument_waves_root_wave_id_monument_waves_id_fk" FOREIGN KEY ("root_wave_id") REFERENCES "public"."monument_waves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monuments_id_season_idx" ON "monuments" USING btree ("id","season_id");--> statement-breakpoint
ALTER TABLE "monument_waves" ADD CONSTRAINT "monument_waves_target_season_fk" FOREIGN KEY ("monument_id","season_id") REFERENCES "public"."monuments"("id","season_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monuments" ADD CONSTRAINT "monuments_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monuments" ADD CONSTRAINT "monuments_controller_player_id_players_id_fk" FOREIGN KEY ("controller_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monuments" ADD CONSTRAINT "monuments_controller_clan_id_clans_id_fk" FOREIGN KEY ("controller_clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hp_radiation_sources_season_time_idx" ON "hp_radiation_sources" USING btree ("season_id","active_from","active_until");--> statement-breakpoint
CREATE INDEX "monument_ship_lots_wave_idx" ON "monument_ship_lots" USING btree ("wave_id");--> statement-breakpoint
CREATE UNIQUE INDEX "monument_waves_unit_location_idx" ON "monument_waves" USING btree ("unit_location");--> statement-breakpoint
CREATE INDEX "monument_waves_target_status_idx" ON "monument_waves" USING btree ("monument_id","status");--> statement-breakpoint
CREATE INDEX "monument_waves_player_status_idx" ON "monument_waves" USING btree ("player_id","status");--> statement-breakpoint
CREATE INDEX "monument_waves_origin_status_idx" ON "monument_waves" USING btree ("origin_planet_id","status");--> statement-breakpoint
CREATE INDEX "monument_waves_root_idx" ON "monument_waves" USING btree ("root_wave_id");--> statement-breakpoint
CREATE UNIQUE INDEX "monuments_season_ordinal_idx" ON "monuments" USING btree ("season_id","ordinal");--> statement-breakpoint
CREATE INDEX "monuments_controller_player_idx" ON "monuments" USING btree ("controller_player_id");--> statement-breakpoint
CREATE INDEX "monuments_controller_clan_idx" ON "monuments" USING btree ("controller_clan_id");

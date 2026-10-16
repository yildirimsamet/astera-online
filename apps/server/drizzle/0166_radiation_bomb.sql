ALTER TYPE "public"."event_kind" ADD VALUE 'radiation_bomb_arrival';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'radiation_bomb_intercept';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'radiation_bomb_intercept_impact';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'planet_radiation_boundary';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'radiation_bomb_result';--> statement-breakpoint
CREATE TABLE "radiation_bomb_flights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"owner_player_id" uuid NOT NULL,
	"origin_planet_id" uuid NOT NULL,
	"target_kind" text NOT NULL,
	"target_planet_id" uuid,
	"target_monument_id" uuid,
	"level" integer NOT NULL,
	"status" text DEFAULT 'OUTBOUND' NOT NULL,
	"depart_at" timestamp with time zone NOT NULL,
	"arrive_at" timestamp with time zone NOT NULL,
	"origin_position" jsonb NOT NULL,
	"target_position" jsonb NOT NULL,
	"charge_id" uuid,
	"interception" jsonb,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "radiation_bomb_flights_level_check" CHECK ("radiation_bomb_flights"."level" IN (1, 2, 3)),
	CONSTRAINT "radiation_bomb_flights_target_check" CHECK (("radiation_bomb_flights"."target_kind" = 'PLANET' AND "radiation_bomb_flights"."target_planet_id" IS NOT NULL AND "radiation_bomb_flights"."target_monument_id" IS NULL)
    OR ("radiation_bomb_flights"."target_kind" = 'MONUMENT' AND "radiation_bomb_flights"."target_monument_id" IS NOT NULL AND "radiation_bomb_flights"."target_planet_id" IS NULL)),
	CONSTRAINT "radiation_bomb_flights_status_check" CHECK ("radiation_bomb_flights"."status" IN ('OUTBOUND', 'HIT', 'INTERCEPTED', 'INEFFECTIVE')),
	CONSTRAINT "radiation_bomb_flights_window_check" CHECK ("radiation_bomb_flights"."arrive_at" > "radiation_bomb_flights"."depart_at"),
	CONSTRAINT "radiation_bomb_flights_resolution_check" CHECK (("radiation_bomb_flights"."status" = 'OUTBOUND' AND "radiation_bomb_flights"."resolved_at" IS NULL)
    OR ("radiation_bomb_flights"."status" <> 'OUTBOUND' AND "radiation_bomb_flights"."resolved_at" IS NOT NULL)),
	CONSTRAINT "radiation_bomb_flights_interception_check" CHECK (("radiation_bomb_flights"."status" = 'INTERCEPTED' AND "radiation_bomb_flights"."charge_id" IS NOT NULL AND "radiation_bomb_flights"."interception" IS NOT NULL)
    OR ("radiation_bomb_flights"."status" <> 'INTERCEPTED' AND "radiation_bomb_flights"."charge_id" IS NULL AND "radiation_bomb_flights"."interception" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "hp_radiation_sources" DROP CONSTRAINT "hp_radiation_sources_level_check";--> statement-breakpoint
ALTER TABLE "strategic_assets" DROP CONSTRAINT "strategic_assets_type_check";--> statement-breakpoint
ALTER TABLE "hp_radiation_sources" ADD COLUMN "origin" text DEFAULT 'ENVIRONMENT' NOT NULL;--> statement-breakpoint
ALTER TABLE "hp_radiation_sources" ADD COLUMN "bomb_flight_id" uuid;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "radiation_settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "radiation_bomb_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "radiation_bomb_flights" ADD CONSTRAINT "radiation_bomb_flights_asset_id_strategic_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."strategic_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiation_bomb_flights" ADD CONSTRAINT "radiation_bomb_flights_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiation_bomb_flights" ADD CONSTRAINT "radiation_bomb_flights_owner_player_id_players_id_fk" FOREIGN KEY ("owner_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiation_bomb_flights" ADD CONSTRAINT "radiation_bomb_flights_origin_planet_id_planets_id_fk" FOREIGN KEY ("origin_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiation_bomb_flights" ADD CONSTRAINT "radiation_bomb_flights_target_planet_id_planets_id_fk" FOREIGN KEY ("target_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiation_bomb_flights" ADD CONSTRAINT "radiation_bomb_flights_target_monument_id_monuments_id_fk" FOREIGN KEY ("target_monument_id") REFERENCES "public"."monuments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiation_bomb_flights" ADD CONSTRAINT "radiation_bomb_flights_charge_id_strategic_assets_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."strategic_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "radiation_bomb_flights_asset_idx" ON "radiation_bomb_flights" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "radiation_bomb_flights_charge_idx" ON "radiation_bomb_flights" USING btree ("charge_id");--> statement-breakpoint
CREATE INDEX "radiation_bomb_flights_origin_status_idx" ON "radiation_bomb_flights" USING btree ("origin_planet_id","status");--> statement-breakpoint
CREATE INDEX "radiation_bomb_flights_target_status_idx" ON "radiation_bomb_flights" USING btree ("target_planet_id","status");--> statement-breakpoint
CREATE INDEX "radiation_bomb_flights_season_status_idx" ON "radiation_bomb_flights" USING btree ("season_id","status");--> statement-breakpoint
ALTER TABLE "hp_radiation_sources" ADD CONSTRAINT "hp_radiation_sources_bomb_flight_id_radiation_bomb_flights_id_fk" FOREIGN KEY ("bomb_flight_id") REFERENCES "public"."radiation_bomb_flights"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hp_radiation_sources_target_time_idx" ON "hp_radiation_sources" USING btree ("season_id","anchor_kind","anchor_id","active_from","active_until");--> statement-breakpoint
CREATE UNIQUE INDEX "hp_radiation_sources_bomb_flight_idx" ON "hp_radiation_sources" USING btree ("bomb_flight_id");--> statement-breakpoint
CREATE UNIQUE INDEX "strategic_assets_bomb_slot_idx" ON "strategic_assets" USING btree ("planet_id","type") WHERE "strategic_assets"."type" IN ('RADIATION_BOMB_L1', 'RADIATION_BOMB_L2', 'RADIATION_BOMB_L3') AND "strategic_assets"."status" IN ('BUILDING', 'PAUSED', 'READY', 'LAUNCHED');--> statement-breakpoint
ALTER TABLE "hp_radiation_sources" ADD CONSTRAINT "hp_radiation_sources_origin_check" CHECK (("hp_radiation_sources"."origin" = 'ENVIRONMENT' AND "hp_radiation_sources"."bomb_flight_id" IS NULL)
    OR ("hp_radiation_sources"."origin" = 'BOMB' AND "hp_radiation_sources"."bomb_flight_id" IS NOT NULL AND "hp_radiation_sources"."mode" = 'EMIT' AND "hp_radiation_sources"."radiation_level" IS NOT NULL AND "hp_radiation_sources"."anchor_kind" <> 'ZONE' AND "hp_radiation_sources"."active_until" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "hp_radiation_sources" ADD CONSTRAINT "hp_radiation_sources_level_check" CHECK ("hp_radiation_sources"."radiation_level" IS NULL OR ("hp_radiation_sources"."radiation_level" IN (1, 2, 3) AND "hp_radiation_sources"."mode" = 'EMIT'));--> statement-breakpoint
ALTER TABLE "strategic_assets" ADD CONSTRAINT "strategic_assets_type_check" CHECK ("strategic_assets"."type" IN ('DEATH_STAR', 'INTERCEPTOR', 'RADIATION_BOMB_L1', 'RADIATION_BOMB_L2', 'RADIATION_BOMB_L3'));
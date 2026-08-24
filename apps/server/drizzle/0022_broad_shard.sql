CREATE TYPE "public"."planet_kind" AS ENUM('CAPITAL', 'COLONY', 'NEUTRAL');--> statement-breakpoint
CREATE TYPE "public"."strategic_asset_status" AS ENUM('BUILDING', 'PAUSED', 'READY', 'LAUNCHED', 'CONSUMED');--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'neutral_reinforce';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'death_star_ready';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'recovery_end';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'occupation_end';--> statement-breakpoint
ALTER TYPE "public"."mission_kind" ADD VALUE 'transfer';--> statement-breakpoint
ALTER TYPE "public"."mission_kind" ADD VALUE 'settlement';--> statement-breakpoint
ALTER TYPE "public"."mission_kind" ADD VALUE 'death_star';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'strategic_incoming';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'death_star_result';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'colony_captured';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'colony_lost';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'settlement_success';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'settlement_lost';--> statement-breakpoint
CREATE TABLE "neutral_planet_state" (
	"planet_id" uuid PRIMARY KEY NOT NULL,
	"tier" integer NOT NULL,
	"profile_seed" integer NOT NULL,
	"claim_until" timestamp with time zone,
	"next_reinforcement_at" timestamp with time zone,
	"economy_anchor_at" timestamp with time zone NOT NULL,
	CONSTRAINT "neutral_planet_tier_check" CHECK ("neutral_planet_state"."tier" BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE TABLE "strategic_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"type" text DEFAULT 'DEATH_STAR' NOT NULL,
	"status" "strategic_asset_status" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ready_at" timestamp with time zone,
	"remaining_seconds" integer,
	"mission_id" uuid,
	CONSTRAINT "strategic_assets_type_check" CHECK ("strategic_assets"."type" = 'DEATH_STAR')
);
--> statement-breakpoint
ALTER TABLE "battle_reports" ALTER COLUMN "defender_player_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ALTER COLUMN "player_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "target_planet_id" uuid;--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "target_kind" text DEFAULT 'PLAYER' NOT NULL;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "owner_player_id" uuid;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "cargo" jsonb;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "kind" "planet_kind" DEFAULT 'CAPITAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "recovery_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "protected_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "rival_player_id" uuid;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "ruleset_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "owner_player_id" uuid;--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN "observer_planet_id" uuid;--> statement-breakpoint
UPDATE "battle_reports" AS br
SET "target_planet_id" = m."target_planet_id"
FROM "missions" AS m
WHERE m."id" = br."mission_id";--> statement-breakpoint
UPDATE "missions" AS m
SET "owner_player_id" = p."player_id"
FROM "planets" AS p
WHERE p."id" = CASE
  WHEN m."kind" = 'return' OR m."parent_mission_id" IS NOT NULL
    THEN m."target_planet_id"
  ELSE m."origin_planet_id"
END;--> statement-breakpoint
UPDATE "units" AS u
SET "owner_player_id" = p."player_id"
FROM "planets" AS p
WHERE p."id" = u."planet_id";--> statement-breakpoint
UPDATE "watches" AS w
SET "observer_planet_id" = p."id"
FROM "planets" AS p
WHERE p."player_id" = w."observer_player_id";--> statement-breakpoint
UPDATE "players" AS pl
SET "rival_player_id" = p."player_id"
FROM "planets" AS p
WHERE p."id" = pl."rival_planet_id";--> statement-breakpoint
ALTER TABLE "neutral_planet_state" ADD CONSTRAINT "neutral_planet_state_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_assets" ADD CONSTRAINT "strategic_assets_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "strategic_assets_planet_active_idx" ON "strategic_assets" USING btree ("planet_id") WHERE "strategic_assets"."status" IN ('BUILDING', 'PAUSED', 'READY');--> statement-breakpoint
CREATE INDEX "strategic_assets_mission_idx" ON "strategic_assets" USING btree ("mission_id");--> statement-breakpoint
ALTER TABLE "battle_reports" ADD CONSTRAINT "battle_reports_target_planet_id_planets_id_fk" FOREIGN KEY ("target_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_owner_player_id_players_id_fk" FOREIGN KEY ("owner_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_owner_player_id_players_id_fk" FOREIGN KEY ("owner_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_observer_planet_id_planets_id_fk" FOREIGN KEY ("observer_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planets" ADD CONSTRAINT "planets_controller_kind_check" CHECK (("planets"."kind" = 'NEUTRAL' AND "planets"."player_id" IS NULL)
      OR ("planets"."kind" <> 'NEUTRAL' AND "planets"."player_id" IS NOT NULL));

CREATE TYPE "public"."event_kind" AS ENUM('mission_arrival', 'radar_warning', 'asteroid_impact', 'season_end');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."mission_kind" AS ENUM('attack', 'probe', 'return');--> statement-breakpoint
CREATE TYPE "public"."mission_status" AS ENUM('in_flight', 'resolved', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('incoming_fleet', 'fleet_returned', 'raided', 'scan_detected');--> statement-breakpoint
CREATE TYPE "public"."season_status" AS ENUM('pending', 'live', 'frozen', 'wiped');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"display_name" text NOT NULL,
	"lifetime" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asteroids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"radius" real NOT NULL,
	"period" real NOT NULL,
	"phase" real NOT NULL,
	"y" real NOT NULL,
	"mass" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battle_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"mission_id" uuid NOT NULL,
	"attacker_player_id" uuid NOT NULL,
	"defender_player_id" uuid NOT NULL,
	"grade" text NOT NULL,
	"rounds" jsonb NOT NULL,
	"loot" jsonb NOT NULL,
	"attacker_losses" jsonb NOT NULL,
	"defender_losses" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buildings" (
	"planet_id" uuid NOT NULL,
	"type" text NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "buildings_planet_id_type_pk" PRIMARY KEY("planet_id","type")
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"kind" "mission_kind" NOT NULL,
	"status" "mission_status" DEFAULT 'in_flight' NOT NULL,
	"origin_planet_id" uuid NOT NULL,
	"target_planet_id" uuid NOT NULL,
	"fleet" jsonb NOT NULL,
	"loot" jsonb,
	"distance" real NOT NULL,
	"depart_at" timestamp with time zone NOT NULL,
	"arrive_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"payload" jsonb NOT NULL,
	"seen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slot_index" integer NOT NULL,
	"x" real NOT NULL,
	"y" real NOT NULL,
	"z" real NOT NULL,
	"alloy" real DEFAULT 500 NOT NULL,
	"crystal" real DEFAULT 120 NOT NULL,
	"shield" real DEFAULT 0 NOT NULL,
	"last_tick_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disrupted_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"name" text NOT NULL,
	"dominion_taken" real DEFAULT 0 NOT NULL,
	"dominion_lost" real DEFAULT 0 NOT NULL,
	"wealth" real DEFAULT 0 NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_log" (
	"idempotency_key" text PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "satellites" (
	"planet_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"type" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "satellites_planet_id_slot_pk" PRIMARY KEY("planet_id","slot")
);
--> statement-breakpoint
CREATE TABLE "scan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_planet_id" uuid NOT NULL,
	"origin_planet_id" uuid NOT NULL,
	"detected" boolean NOT NULL,
	"bearing" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"kind" "event_kind" NOT NULL,
	"ref_id" uuid,
	"payload" jsonb,
	"resolve_at" timestamp with time zone NOT NULL,
	"status" "event_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shard_id" uuid NOT NULL,
	"seed" integer NOT NULL,
	"status" "season_status" DEFAULT 'pending' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"region" text DEFAULT 'eu' NOT NULL,
	"player_cap" integer DEFAULT 200 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"planet_id" uuid NOT NULL,
	"hull" text NOT NULL,
	"location" text DEFAULT 'home' NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "units_planet_id_hull_location_pk" PRIMARY KEY("planet_id","hull","location")
);
--> statement-breakpoint
CREATE TABLE "watches" (
	"observer_player_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"target_planet_id" uuid NOT NULL,
	"last_status" text,
	"last_confirmed_at" timestamp with time zone,
	CONSTRAINT "watches_observer_player_id_slot_pk" PRIMARY KEY("observer_player_id","slot")
);
--> statement-breakpoint
ALTER TABLE "asteroids" ADD CONSTRAINT "asteroids_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_reports" ADD CONSTRAINT "battle_reports_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_reports" ADD CONSTRAINT "battle_reports_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_reports" ADD CONSTRAINT "battle_reports_attacker_player_id_players_id_fk" FOREIGN KEY ("attacker_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_reports" ADD CONSTRAINT "battle_reports_defender_player_id_players_id_fk" FOREIGN KEY ("defender_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_origin_planet_id_planets_id_fk" FOREIGN KEY ("origin_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_target_planet_id_planets_id_fk" FOREIGN KEY ("target_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planets" ADD CONSTRAINT "planets_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planets" ADD CONSTRAINT "planets_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_log" ADD CONSTRAINT "request_log_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satellites" ADD CONSTRAINT "satellites_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_target_planet_id_planets_id_fk" FOREIGN KEY ("target_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_origin_planet_id_planets_id_fk" FOREIGN KEY ("origin_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_events" ADD CONSTRAINT "scheduled_events_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_shard_id_shards_id_fk" FOREIGN KEY ("shard_id") REFERENCES "public"."shards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_observer_player_id_players_id_fk" FOREIGN KEY ("observer_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_target_planet_id_planets_id_fk" FOREIGN KEY ("target_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_email_idx" ON "accounts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "asteroids_season_idx" ON "asteroids" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "reports_defender_idx" ON "battle_reports" USING btree ("defender_player_id","created_at");--> statement-breakpoint
CREATE INDEX "reports_attacker_idx" ON "battle_reports" USING btree ("attacker_player_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_mission_idx" ON "battle_reports" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "missions_status_arrive_idx" ON "missions" USING btree ("status","arrive_at");--> statement-breakpoint
CREATE INDEX "missions_origin_idx" ON "missions" USING btree ("origin_planet_id");--> statement-breakpoint
CREATE INDEX "missions_target_idx" ON "missions" USING btree ("target_planet_id");--> statement-breakpoint
CREATE INDEX "notifications_player_idx" ON "notifications" USING btree ("player_id","seen","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "planets_player_idx" ON "planets" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planets_season_slot_idx" ON "planets" USING btree ("season_id","slot_index");--> statement-breakpoint
CREATE INDEX "planets_season_idx" ON "planets" USING btree ("season_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_account_season_idx" ON "players" USING btree ("account_id","season_id");--> statement-breakpoint
CREATE INDEX "players_ladder_idx" ON "players" USING btree ("season_id","dominion_taken","dominion_lost");--> statement-breakpoint
CREATE INDEX "scans_target_idx" ON "scan_events" USING btree ("target_planet_id","created_at");--> statement-breakpoint
CREATE INDEX "events_due_idx" ON "scheduled_events" USING btree ("status","resolve_at");--> statement-breakpoint
CREATE INDEX "events_claimed_idx" ON "scheduled_events" USING btree ("status","claimed_at");--> statement-breakpoint
CREATE INDEX "seasons_shard_status_idx" ON "seasons" USING btree ("shard_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "shards_code_idx" ON "shards" USING btree ("code");
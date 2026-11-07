CREATE TYPE "public"."starter_event_kind" AS ENUM('vessel_order_complete', 'vessel_mission_arrival', 'vessel_mission_return', 'vessel_radar_warning', 'site_respawn', 'npc_raid_launch', 'pvp_shield_warning');--> statement-breakpoint
CREATE TYPE "public"."vessel_status" AS ENUM('ACTIVE', 'DORMANT', 'DEPARTING', 'DEPARTED');--> statement-breakpoint
CREATE TABLE "starter_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"starter_galaxy_id" uuid NOT NULL,
	"kind" "starter_event_kind" NOT NULL,
	"ref_id" uuid,
	"payload" jsonb,
	"dedupe_key" text,
	"resolve_at" timestamp with time zone NOT NULL,
	"status" "event_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "starter_galaxies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shard_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"seed" integer NOT NULL,
	"epoch" timestamp with time zone NOT NULL,
	"capacity" integer NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vessel_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vessel_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"seen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vessel_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vessel_id" uuid NOT NULL,
	"queue" text NOT NULL,
	"slot" integer NOT NULL,
	"subject" text NOT NULL,
	"stage" integer NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'BUILDING' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ready_at" timestamp with time zone NOT NULL,
	"remaining_seconds" integer NOT NULL,
	"cost" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vessel_units" (
	"vessel_id" uuid NOT NULL,
	"hull" text NOT NULL,
	"location" text NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "vessel_units_vessel_id_hull_location_pk" PRIMARY KEY("vessel_id","hull","location")
);
--> statement-breakpoint
CREATE TABLE "vessels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"starter_galaxy_id" uuid NOT NULL,
	"slot_index" integer,
	"x" real NOT NULL,
	"y" real NOT NULL,
	"z" real NOT NULL,
	"name" text NOT NULL,
	"alloy" real NOT NULL,
	"crystal" real NOT NULL,
	"deuterium" real DEFAULT 0 NOT NULL,
	"buffer_alloy" real DEFAULT 0 NOT NULL,
	"buffer_crystal" real DEFAULT 0 NOT NULL,
	"buffer_deuterium" real DEFAULT 0 NOT NULL,
	"shield" real DEFAULT 0 NOT NULL,
	"last_tick_minutes" double precision NOT NULL,
	"modules" jsonb NOT NULL,
	"research" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parts" integer DEFAULT 0 NOT NULL,
	"fuel" real DEFAULT 0 NOT NULL,
	"status" "vessel_status" DEFAULT 'ACTIVE' NOT NULL,
	"pvp_open_at" timestamp with time zone,
	"recovery_until" timestamp with time zone,
	"unlocks_seen" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enlisted_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "starter_events" ADD CONSTRAINT "starter_events_starter_galaxy_id_starter_galaxies_id_fk" FOREIGN KEY ("starter_galaxy_id") REFERENCES "public"."starter_galaxies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "starter_galaxies" ADD CONSTRAINT "starter_galaxies_shard_id_shards_id_fk" FOREIGN KEY ("shard_id") REFERENCES "public"."shards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_notifications" ADD CONSTRAINT "vessel_notifications_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_orders" ADD CONSTRAINT "vessel_orders_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_units" ADD CONSTRAINT "vessel_units_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessels" ADD CONSTRAINT "vessels_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessels" ADD CONSTRAINT "vessels_starter_galaxy_id_starter_galaxies_id_fk" FOREIGN KEY ("starter_galaxy_id") REFERENCES "public"."starter_galaxies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "starter_events_due_idx" ON "starter_events" USING btree ("status","resolve_at");--> statement-breakpoint
CREATE INDEX "starter_events_claimed_idx" ON "starter_events" USING btree ("status","claimed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "starter_events_dedupe_key_idx" ON "starter_events" USING btree ("dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "starter_galaxies_shard_ordinal_idx" ON "starter_galaxies" USING btree ("shard_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "vessel_notifications_once_idx" ON "vessel_notifications" USING btree ("vessel_id","kind","ref_id");--> statement-breakpoint
CREATE INDEX "vessel_notifications_recent_idx" ON "vessel_notifications" USING btree ("vessel_id","created_at");--> statement-breakpoint
CREATE INDEX "vessel_orders_active_idx" ON "vessel_orders" USING btree ("vessel_id","status","queue","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "vessels_account_idx" ON "vessels" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vessels_berth_idx" ON "vessels" USING btree ("starter_galaxy_id","slot_index") WHERE "vessels"."status" <> 'DEPARTED';--> statement-breakpoint
CREATE INDEX "vessels_galaxy_status_idx" ON "vessels" USING btree ("starter_galaxy_id","status");
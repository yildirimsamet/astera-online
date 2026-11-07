CREATE TABLE "starter_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"starter_galaxy_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"x" real NOT NULL,
	"y" real NOT NULL,
	"z" real NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"alloy" real DEFAULT 0 NOT NULL,
	"crystal" real DEFAULT 0 NOT NULL,
	"deuterium" real DEFAULT 0 NOT NULL,
	"stock_full" real DEFAULT 0 NOT NULL,
	"guard" jsonb,
	"guard_full" jsonb,
	"has_part" boolean DEFAULT false NOT NULL,
	"respawn_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vessel_battle_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"starter_galaxy_id" uuid NOT NULL,
	"mission_id" uuid NOT NULL,
	"attacker_vessel_id" uuid,
	"defender_vessel_id" uuid,
	"site_id" uuid,
	"attacker_name" text NOT NULL,
	"defender_name" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"grade" text NOT NULL,
	"result" jsonb NOT NULL,
	"replay" jsonb,
	"ruleset_version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vessel_missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"starter_galaxy_id" uuid NOT NULL,
	"owner_vessel_id" uuid,
	"kind" text NOT NULL,
	"target_vessel_id" uuid,
	"target_site_id" uuid,
	"from_x" real NOT NULL,
	"from_y" real NOT NULL,
	"from_z" real NOT NULL,
	"to_x" real NOT NULL,
	"to_y" real NOT NULL,
	"to_z" real NOT NULL,
	"fleet" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"damage" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cargo" jsonb DEFAULT '{"alloy":0,"crystal":0,"deuterium":0}'::jsonb NOT NULL,
	"carries_part" boolean DEFAULT false NOT NULL,
	"fuel_paid" integer DEFAULT 0 NOT NULL,
	"depart_at" timestamp with time zone NOT NULL,
	"arrive_at" timestamp with time zone NOT NULL,
	"return_at" timestamp with time zone,
	"status" text DEFAULT 'OUTBOUND' NOT NULL,
	"idempotency_key" text
);
--> statement-breakpoint
CREATE TABLE "vessel_probe_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"observer_vessel_id" uuid NOT NULL,
	"target_vessel_id" uuid,
	"target_site_id" uuid,
	"mission_id" uuid NOT NULL,
	"target_name" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"accuracy" real NOT NULL,
	"snapshot" jsonb NOT NULL,
	"detected" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vessel_scan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_vessel_id" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"detected" boolean NOT NULL,
	"bearing" text
);
--> statement-breakpoint
CREATE TABLE "vessel_watches" (
	"observer_vessel_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"target_vessel_id" uuid NOT NULL,
	"cooldown_until" timestamp with time zone,
	CONSTRAINT "vessel_watches_observer_vessel_id_slot_pk" PRIMARY KEY("observer_vessel_id","slot")
);
--> statement-breakpoint
ALTER TABLE "vessel_units" ADD COLUMN "damage" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "starter_sites" ADD CONSTRAINT "starter_sites_starter_galaxy_id_starter_galaxies_id_fk" FOREIGN KEY ("starter_galaxy_id") REFERENCES "public"."starter_galaxies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_battle_reports" ADD CONSTRAINT "vessel_battle_reports_starter_galaxy_id_starter_galaxies_id_fk" FOREIGN KEY ("starter_galaxy_id") REFERENCES "public"."starter_galaxies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_battle_reports" ADD CONSTRAINT "vessel_battle_reports_attacker_vessel_id_vessels_id_fk" FOREIGN KEY ("attacker_vessel_id") REFERENCES "public"."vessels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_battle_reports" ADD CONSTRAINT "vessel_battle_reports_defender_vessel_id_vessels_id_fk" FOREIGN KEY ("defender_vessel_id") REFERENCES "public"."vessels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_missions" ADD CONSTRAINT "vessel_missions_starter_galaxy_id_starter_galaxies_id_fk" FOREIGN KEY ("starter_galaxy_id") REFERENCES "public"."starter_galaxies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_missions" ADD CONSTRAINT "vessel_missions_owner_vessel_id_vessels_id_fk" FOREIGN KEY ("owner_vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_missions" ADD CONSTRAINT "vessel_missions_target_vessel_id_vessels_id_fk" FOREIGN KEY ("target_vessel_id") REFERENCES "public"."vessels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_probe_reports" ADD CONSTRAINT "vessel_probe_reports_observer_vessel_id_vessels_id_fk" FOREIGN KEY ("observer_vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_probe_reports" ADD CONSTRAINT "vessel_probe_reports_target_vessel_id_vessels_id_fk" FOREIGN KEY ("target_vessel_id") REFERENCES "public"."vessels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_scan_events" ADD CONSTRAINT "vessel_scan_events_target_vessel_id_vessels_id_fk" FOREIGN KEY ("target_vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_watches" ADD CONSTRAINT "vessel_watches_observer_vessel_id_vessels_id_fk" FOREIGN KEY ("observer_vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_watches" ADD CONSTRAINT "vessel_watches_target_vessel_id_vessels_id_fk" FOREIGN KEY ("target_vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "starter_sites_galaxy_idx" ON "starter_sites" USING btree ("starter_galaxy_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "vessel_battle_reports_mission_idx" ON "vessel_battle_reports" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "vessel_battle_reports_attacker_idx" ON "vessel_battle_reports" USING btree ("attacker_vessel_id","at");--> statement-breakpoint
CREATE INDEX "vessel_battle_reports_defender_idx" ON "vessel_battle_reports" USING btree ("defender_vessel_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "vessel_missions_once_idx" ON "vessel_missions" USING btree ("owner_vessel_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "vessel_missions_target_idx" ON "vessel_missions" USING btree ("target_vessel_id","status");--> statement-breakpoint
CREATE INDEX "vessel_missions_owner_idx" ON "vessel_missions" USING btree ("owner_vessel_id","status");--> statement-breakpoint
CREATE INDEX "vessel_missions_galaxy_idx" ON "vessel_missions" USING btree ("starter_galaxy_id","status");--> statement-breakpoint
CREATE INDEX "vessel_probe_reports_observer_idx" ON "vessel_probe_reports" USING btree ("observer_vessel_id","at");--> statement-breakpoint
CREATE INDEX "vessel_probe_reports_target_idx" ON "vessel_probe_reports" USING btree ("target_vessel_id","at");--> statement-breakpoint
CREATE INDEX "vessel_scan_events_target_idx" ON "vessel_scan_events" USING btree ("target_vessel_id","at");
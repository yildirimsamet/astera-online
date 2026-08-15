CREATE TABLE "probe_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"observer_player_id" uuid NOT NULL,
	"target_planet_id" uuid NOT NULL,
	"mission_id" uuid NOT NULL,
	"accuracy" real NOT NULL,
	"stock" jsonb NOT NULL,
	"defence" jsonb NOT NULL,
	"fleet_size" jsonb NOT NULL,
	"fleet_home" boolean NOT NULL,
	"detected" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "probe_reports" ADD CONSTRAINT "probe_reports_observer_player_id_players_id_fk" FOREIGN KEY ("observer_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probe_reports" ADD CONSTRAINT "probe_reports_target_planet_id_planets_id_fk" FOREIGN KEY ("target_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probe_reports" ADD CONSTRAINT "probe_reports_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "probe_reports_observer_idx" ON "probe_reports" USING btree ("observer_player_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "probe_reports_mission_idx" ON "probe_reports" USING btree ("mission_id");
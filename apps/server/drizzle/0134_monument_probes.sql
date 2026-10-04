ALTER TYPE "public"."event_kind" ADD VALUE 'monument_probe';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'monument_probe_lost';--> statement-breakpoint
CREATE TABLE "monument_probes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"monument_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"origin_planet_id" uuid NOT NULL,
	"status" text DEFAULT 'OUTBOUND' NOT NULL,
	"outbound_route" jsonb NOT NULL,
	"return_route" jsonb,
	"depart_at" timestamp with time zone NOT NULL,
	"arrive_at" timestamp with time zone NOT NULL,
	"home_at" timestamp with time zone,
	"snapshot_fleet" jsonb,
	"observed_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	CONSTRAINT "monument_probes_status_check" CHECK ("monument_probes"."status" IN ('OUTBOUND', 'RETURNING', 'HOME', 'LOST', 'CANCELLED')),
	CONSTRAINT "monument_probes_clock_check" CHECK ("monument_probes"."arrive_at" >= "monument_probes"."depart_at"
    AND ("monument_probes"."home_at" IS NULL OR "monument_probes"."home_at" >= "monument_probes"."arrive_at")),
	CONSTRAINT "monument_probes_snapshot_check" CHECK (CASE
    WHEN "monument_probes"."status" IN ('OUTBOUND', 'LOST', 'CANCELLED') THEN "monument_probes"."snapshot_fleet" IS NULL AND "monument_probes"."observed_at" IS NULL AND "monument_probes"."delivered_at" IS NULL
    WHEN "monument_probes"."status" = 'RETURNING' THEN "monument_probes"."snapshot_fleet" IS NOT NULL AND "monument_probes"."observed_at" IS NOT NULL AND "monument_probes"."home_at" IS NOT NULL AND "monument_probes"."return_route" IS NOT NULL AND "monument_probes"."delivered_at" IS NULL
    WHEN "monument_probes"."status" = 'HOME' THEN "monument_probes"."snapshot_fleet" IS NOT NULL AND "monument_probes"."observed_at" IS NOT NULL AND "monument_probes"."delivered_at" IS NOT NULL
    ELSE false END)
);
--> statement-breakpoint
ALTER TABLE "monument_probes" ADD CONSTRAINT "monument_probes_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monument_probes" ADD CONSTRAINT "monument_probes_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monument_probes" ADD CONSTRAINT "monument_probes_origin_planet_id_planets_id_fk" FOREIGN KEY ("origin_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monument_probes" ADD CONSTRAINT "monument_probes_target_season_fk" FOREIGN KEY ("monument_id","season_id") REFERENCES "public"."monuments"("id","season_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "monument_probes_target_arrival_idx" ON "monument_probes" USING btree ("monument_id","status","arrive_at");--> statement-breakpoint
CREATE INDEX "monument_probes_player_idx" ON "monument_probes" USING btree ("player_id","status");--> statement-breakpoint
CREATE INDEX "monument_probes_origin_idx" ON "monument_probes" USING btree ("origin_planet_id");
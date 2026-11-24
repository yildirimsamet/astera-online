-- Ay F5 (§4.1, §4.2, §6.12, V32): Gözcü reports, and the in-flight partial indexes on missions (13,002 rows on prod,
-- measured 2026-11-19: building them inside the migration's transaction takes milliseconds).
CREATE TABLE "moon_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"scanner_player_id" uuid NOT NULL,
	"scanner_planet_id" uuid NOT NULL,
	"target_planet_id" uuid NOT NULL,
	"scanned_at" timestamp with time zone NOT NULL,
	"fuel_paid" real NOT NULL,
	"pierced" boolean NOT NULL,
	"rows" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "moon_scans" ADD CONSTRAINT "moon_scans_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moon_scans" ADD CONSTRAINT "moon_scans_scanner_player_id_players_id_fk" FOREIGN KEY ("scanner_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moon_scans_scanner_idx" ON "moon_scans" USING btree ("scanner_player_id","scanned_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "moon_scans_scanner_planet_idx" ON "moon_scans" USING btree ("scanner_planet_id","scanned_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "missions_target_in_flight_idx" ON "missions" USING btree ("target_planet_id") WHERE "missions"."status" = 'in_flight';--> statement-breakpoint
CREATE INDEX "missions_origin_in_flight_idx" ON "missions" USING btree ("origin_planet_id") WHERE "missions"."status" = 'in_flight';
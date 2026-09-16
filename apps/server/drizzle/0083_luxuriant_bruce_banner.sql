CREATE TABLE "season_telemetry_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"source_planet_id" uuid NOT NULL,
	"telemetry" jsonb NOT NULL,
	"closed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "season_telemetry_segments" ADD CONSTRAINT "season_telemetry_segments_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_telemetry_segments" ADD CONSTRAINT "season_telemetry_segments_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "season_telemetry_segments_season_player_idx" ON "season_telemetry_segments" USING btree ("season_id","player_id");
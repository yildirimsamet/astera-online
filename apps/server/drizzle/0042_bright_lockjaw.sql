CREATE TABLE "sensor_epochs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"planet_id" uuid NOT NULL,
	"x" real NOT NULL,
	"y" real NOT NULL,
	"z" real NOT NULL,
	"reach" real NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	CONSTRAINT "sensor_epochs_reach_check" CHECK ("sensor_epochs"."reach" > 0),
	CONSTRAINT "sensor_epochs_window_check" CHECK ("sensor_epochs"."ends_at" is null or "sensor_epochs"."ends_at" > "sensor_epochs"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "asteroid_key" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "sensor_epochs" ADD CONSTRAINT "sensor_epochs_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_epochs" ADD CONSTRAINT "sensor_epochs_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_epochs" ADD CONSTRAINT "sensor_epochs_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sensor_epochs_open_planet_idx" ON "sensor_epochs" USING btree ("planet_id") WHERE "sensor_epochs"."ends_at" is null;--> statement-breakpoint
CREATE INDEX "sensor_epochs_player_time_idx" ON "sensor_epochs" USING btree ("player_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "sensor_epochs_season_idx" ON "sensor_epochs" USING btree ("season_id");

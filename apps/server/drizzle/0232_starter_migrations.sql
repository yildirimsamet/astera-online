CREATE TABLE "starter_departures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"starter_galaxy_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"country_code" char(2) NOT NULL,
	"x" real NOT NULL,
	"y" real NOT NULL,
	"z" real NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vessel_migrations" (
	"vessel_id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"slot_choice" integer,
	"cargo" jsonb NOT NULL,
	"cargo_landed" boolean DEFAULT false NOT NULL,
	"player_id" uuid,
	"planet_id" uuid,
	"shard_code" text,
	"shard_name" text,
	"season_id" uuid,
	"arrival_seen_at" timestamp with time zone,
	"last_error" text,
	"started_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "starter_departures" ADD CONSTRAINT "starter_departures_starter_galaxy_id_starter_galaxies_id_fk" FOREIGN KEY ("starter_galaxy_id") REFERENCES "public"."starter_galaxies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "starter_departures" ADD CONSTRAINT "starter_departures_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_migrations" ADD CONSTRAINT "vessel_migrations_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "starter_departures_recent_idx" ON "starter_departures" USING btree ("starter_galaxy_id","at");--> statement-breakpoint
CREATE INDEX "vessel_migrations_departing_idx" ON "vessel_migrations" USING btree ("started_at") WHERE "vessel_migrations"."status" = 'DEPARTING';
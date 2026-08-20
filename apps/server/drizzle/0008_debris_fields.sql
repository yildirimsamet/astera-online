CREATE TABLE "debris_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"planet_id" uuid NOT NULL,
	"mission_id" uuid,
	"alloy" real NOT NULL,
	"crystal" real NOT NULL,
	"taken_alloy" real DEFAULT 0 NOT NULL,
	"taken_crystal" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mining_runs" ALTER COLUMN "asteroid_index" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mining_runs" ADD COLUMN "target_kind" text DEFAULT 'asteroid' NOT NULL;--> statement-breakpoint
ALTER TABLE "mining_runs" ADD COLUMN "debris_field_id" uuid;--> statement-breakpoint
ALTER TABLE "debris_fields" ADD CONSTRAINT "debris_fields_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debris_fields" ADD CONSTRAINT "debris_fields_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debris_fields" ADD CONSTRAINT "debris_fields_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debris_season_idx" ON "debris_fields" USING btree ("season_id","created_at");--> statement-breakpoint
CREATE INDEX "debris_planet_idx" ON "debris_fields" USING btree ("planet_id");--> statement-breakpoint
ALTER TABLE "mining_runs" ADD CONSTRAINT "mining_runs_debris_field_id_debris_fields_id_fk" FOREIGN KEY ("debris_field_id") REFERENCES "public"."debris_fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mining_planet_debris_idx" ON "mining_runs" USING btree ("planet_id","debris_field_id") WHERE status <> 'done';--> statement-breakpoint
ALTER TABLE "mining_runs" ADD CONSTRAINT "mining_one_target" CHECK ((asteroid_index is not null and debris_field_id is null)
     or (asteroid_index is null and debris_field_id is not null));
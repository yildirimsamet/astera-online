CREATE TABLE "galaxy_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text NOT NULL,
	"subject_planet_id" uuid,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "galaxy_events" ADD CONSTRAINT "galaxy_events_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "galaxy_events_source_idx" ON "galaxy_events" USING btree ("season_id","kind","ref_id");--> statement-breakpoint
CREATE INDEX "galaxy_events_season_cursor_idx" ON "galaxy_events" USING btree ("season_id","occurred_at","id");
CREATE TYPE "public"."galaxy_event_occurrence_kind" AS ENUM('ASTEROID_SHOWER');--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'galaxy_event_start';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'galaxy_event_end';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'galaxy_event_started';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'galaxy_event_ended';--> statement-breakpoint
CREATE TABLE "galaxy_event_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"kind" "galaxy_event_occurrence_kind" NOT NULL,
	"definition_version" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"effect" jsonb NOT NULL,
	"start_processed_at" timestamp with time zone,
	"end_processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "galaxy_event_occurrences_sequence_check" CHECK ("galaxy_event_occurrences"."sequence" >= 0),
	CONSTRAINT "galaxy_event_occurrences_window_check" CHECK ("galaxy_event_occurrences"."ends_at" > "galaxy_event_occurrences"."starts_at"),
	CONSTRAINT "galaxy_event_occurrences_definition_version_check" CHECK ("galaxy_event_occurrences"."definition_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "scheduled_events" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "galaxy_event_occurrences" ADD CONSTRAINT "galaxy_event_occurrences_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "galaxy_event_occurrences_season_sequence_idx" ON "galaxy_event_occurrences" USING btree ("season_id","sequence");--> statement-breakpoint
CREATE INDEX "galaxy_event_occurrences_active_idx" ON "galaxy_event_occurrences" USING btree ("season_id","starts_at","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "events_dedupe_key_idx" ON "scheduled_events" USING btree ("dedupe_key");
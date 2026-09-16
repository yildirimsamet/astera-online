ALTER TYPE "public"."event_kind" ADD VALUE 'asteroid_hour';--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "asteroid_dynamic_from" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "asteroid_legacy_calendar" jsonb;--> statement-breakpoint
CREATE TABLE "asteroid_spawn_hours" (
	"season_id" uuid NOT NULL,
	"hour_starts_at" timestamp with time zone NOT NULL,
	"spawn_from" timestamp with time zone NOT NULL,
	"active_players" integer NOT NULL,
	"lanes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asteroid_spawn_hours_season_id_hour_starts_at_pk" PRIMARY KEY("season_id","hour_starts_at"),
	CONSTRAINT "asteroid_spawn_hours_active_players_check" CHECK ("active_players" >= 0)
);--> statement-breakpoint
ALTER TABLE "asteroid_spawn_hours" ADD CONSTRAINT "asteroid_spawn_hours_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;

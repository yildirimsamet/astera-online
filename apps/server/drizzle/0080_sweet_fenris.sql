ALTER TABLE "season_results" ADD COLUMN "stats_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "season_results" ADD COLUMN "stats" jsonb;--> statement-breakpoint
ALTER TABLE "season_results" ADD COLUMN "average_eligible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "stats_version" integer DEFAULT 0 NOT NULL;
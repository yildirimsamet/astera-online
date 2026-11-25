ALTER TYPE "public"."event_kind" ADD VALUE 'honor_penalty_sync';--> statement-breakpoint
ALTER TABLE "monument_waves" ADD COLUMN "fuel_pct" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "honor_production_share" double precision DEFAULT 0 NOT NULL;
ALTER TYPE "public"."event_kind" ADD VALUE 'strategic_intercept';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'strategic_intercepted';--> statement-breakpoint
DROP INDEX "strategic_assets_planet_active_idx";--> statement-breakpoint
CREATE INDEX "strategic_assets_planet_active_idx" ON "strategic_assets" USING btree ("planet_id","status");

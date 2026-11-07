-- A starter probe flies home before its report can be read, as the main galaxy's does (owner 2026-11-07).
ALTER TABLE "vessel_probe_reports" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone;--> statement-breakpoint
UPDATE "vessel_probe_reports" SET "delivered_at" = "at" WHERE "delivered_at" IS NULL;

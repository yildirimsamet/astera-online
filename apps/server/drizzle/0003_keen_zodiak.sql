ALTER TABLE "missions" ADD COLUMN "parent_mission_id" uuid;--> statement-breakpoint
ALTER TABLE "probe_reports" ADD COLUMN "delivered_at" timestamp with time zone;
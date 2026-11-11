ALTER TYPE "public"."notification_kind" ADD VALUE 'clan_support_lifted';--> statement-breakpoint
ALTER TABLE "planets" DROP CONSTRAINT "planets_defence_posture_check";--> statement-breakpoint
ALTER TABLE "probe_reports" DROP CONSTRAINT "probe_reports_posture_check";--> statement-breakpoint
ALTER TABLE "planets" ALTER COLUMN "defence_posture" SET DEFAULT 'ESCAPE_SUPPORT';--> statement-breakpoint
ALTER TABLE "planets" ADD CONSTRAINT "planets_defence_posture_check" CHECK ("planets"."defence_posture" IN ('ESCAPE', 'SUPPORT', 'HOLD', 'ESCAPE_SUPPORT'));--> statement-breakpoint
ALTER TABLE "probe_reports" ADD CONSTRAINT "probe_reports_posture_check" CHECK ("probe_reports"."posture" IS NULL OR "probe_reports"."posture" IN ('ESCAPE', 'SUPPORT', 'HOLD', 'ESCAPE_SUPPORT'));--> statement-breakpoint
-- F1 (owner 2026-11-10): the retreat and clan support may both be on, and both-on is the untouched
-- default. A world at ESCAPE was never asked; it takes the new default. SUPPORT and HOLD were chosen.
UPDATE "planets" SET "defence_posture" = 'ESCAPE_SUPPORT' WHERE "defence_posture" = 'ESCAPE';

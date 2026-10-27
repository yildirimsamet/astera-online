ALTER TYPE "public"."notification_kind" ADD VALUE 'arena_team_share';--> statement-breakpoint
ALTER TABLE "arena_admirals" ADD COLUMN "home_depart_at" timestamp with time zone;
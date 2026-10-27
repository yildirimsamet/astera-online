ALTER TYPE "public"."event_kind" ADD VALUE 'arena_ship_ready';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'arena_ship_ready';--> statement-breakpoint
ALTER TABLE "arena_ships" ADD COLUMN "ready_notice_id" uuid;
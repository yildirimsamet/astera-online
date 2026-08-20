ALTER TYPE "public"."event_kind" ADD VALUE 'mining_arrival';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'mining_return';--> statement-breakpoint
DROP TABLE "asteroids" CASCADE;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "buffer_alloy" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "buffer_crystal" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN "cooldown_until" timestamp with time zone;
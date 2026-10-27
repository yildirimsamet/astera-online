ALTER TABLE "seasons" ADD COLUMN "admiral_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'arena_sortie_end';
ALTER TABLE "arena_admirals" ADD COLUMN "lost" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "arena_admirals" ADD COLUMN "lost_value" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "arena_admirals" ADD CONSTRAINT "arena_admirals_lost_value_check" CHECK ("arena_admirals"."lost_value" >= 0);--> statement-breakpoint
ALTER TABLE "arena_admirals" DROP COLUMN "won";
--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "admirals" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "monument_battle_participants" ADD COLUMN "admiral" jsonb;

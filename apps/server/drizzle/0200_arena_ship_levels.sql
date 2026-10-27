ALTER TABLE "arena_ships" ADD COLUMN "level" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "arena_ships" ADD COLUMN "xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "arena_ships" ADD CONSTRAINT "arena_ships_level_check" CHECK ("arena_ships"."level" BETWEEN 1 AND 20 AND "arena_ships"."xp" >= 0);
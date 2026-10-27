ALTER TABLE "arena_ships" ADD COLUMN "fuel_plan" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "arena_ships" ADD COLUMN "ammo_plan" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "arena_ships" ADD CONSTRAINT "arena_ships_plan_check" CHECK ("arena_ships"."fuel_plan" IN (25, 50, 75, 100) AND "arena_ships"."ammo_plan" IN (0, 25, 50, 75, 100));
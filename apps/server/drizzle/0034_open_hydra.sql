ALTER TABLE "battle_reports" ADD COLUMN "attacker_fleet" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "defender_fleet" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "defence_salvage" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "disrupted_minutes" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "wreck_value" real DEFAULT 0 NOT NULL;
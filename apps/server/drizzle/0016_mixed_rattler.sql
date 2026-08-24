ALTER TABLE "debris_fields" ADD COLUMN "deuterium" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "debris_fields" ADD COLUMN "taken_deuterium" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mining_runs" ADD COLUMN "mined_deuterium" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "deuterium" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "buffer_deuterium" real DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "missions"
SET "loot" = "loot" || '{"deuterium": 0}'::jsonb
WHERE "loot" IS NOT NULL AND NOT ("loot" ? 'deuterium');--> statement-breakpoint
UPDATE "battle_reports"
SET "loot" = "loot" || '{"deuterium": 0}'::jsonb
WHERE NOT ("loot" ? 'deuterium');

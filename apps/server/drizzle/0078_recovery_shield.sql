ALTER TABLE "battle_reports" ADD COLUMN "raidable_before" bigint;--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "recovery_shield_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "recovery_shield_until" timestamp with time zone;
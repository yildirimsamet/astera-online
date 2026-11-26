ALTER TABLE "bot_profiles" ADD COLUMN "strength" text DEFAULT 'NORMAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "bot_profiles" ADD CONSTRAINT "bot_profiles_strength_check" CHECK ("bot_profiles"."strength" IN ('NORMAL', 'STRONG', 'ELITE'));--> statement-breakpoint
-- The live guards were the first two RAIDER profiles by ordinal; they stay ELITE (owner plan 2026-11-26, F2).
UPDATE "bot_profiles" SET "strength" = 'ELITE' WHERE "account_id" IN (SELECT "account_id" FROM "bot_profiles" WHERE "persona" = 'RAIDER' ORDER BY "ordinal" LIMIT 2);

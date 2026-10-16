DROP INDEX "season_reward_entitlements_source_place_idx";--> statement-breakpoint
ALTER TABLE "season_results" ADD COLUMN "honor_score" bigint;--> statement-breakpoint
ALTER TABLE "season_results" ADD COLUMN "honor_rank" integer;--> statement-breakpoint
ALTER TABLE "season_reward_entitlements" ADD COLUMN "ranking" text DEFAULT 'DOMINION' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "season_reward_entitlements_source_place_idx" ON "season_reward_entitlements" USING btree ("source_season_id","reward_place") WHERE "season_reward_entitlements"."ranking" = 'DOMINION';--> statement-breakpoint
ALTER TABLE "season_results" ADD CONSTRAINT "season_results_honor_check" CHECK (("season_results"."honor_score" IS NULL) = ("season_results"."honor_rank" IS NULL)
    AND ("season_results"."honor_score" IS NULL OR ("season_results"."honor_score" BETWEEN -9007199254740991 AND 9007199254740991 AND "season_results"."honor_rank" > 0)));--> statement-breakpoint
ALTER TABLE "season_reward_entitlements" ADD CONSTRAINT "season_reward_entitlements_ranking_check" CHECK ("season_reward_entitlements"."ranking" IN ('DOMINION', 'HONOR'));
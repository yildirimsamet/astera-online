ALTER TABLE "build_orders" ADD COLUMN "analytics_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "mining_runs" ADD COLUMN "analytics_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "analytics_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "monument_waves" ADD COLUMN "analytics_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "pirate_raids" ADD COLUMN "analytics_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "research_orders" ADD COLUMN "analytics_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "trade_runs" ADD COLUMN "analytics_attempt_id" uuid;
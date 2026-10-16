ALTER TABLE "trade_runs" ADD COLUMN "recalled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "trade_runs" ADD COLUMN "recall_from" jsonb;

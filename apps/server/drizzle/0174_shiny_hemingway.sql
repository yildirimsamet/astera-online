ALTER TABLE "honor_seasons" ADD COLUMN "benefits_version" integer;--> statement-breakpoint
ALTER TABLE "intergalactic_convoy_runs" ADD COLUMN "honor_resource_pct" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "trade_runs" ADD COLUMN "honor_commission_pct" integer DEFAULT 0 NOT NULL;
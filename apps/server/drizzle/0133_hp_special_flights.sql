ALTER TABLE "intergalactic_convoy_runs" ADD COLUMN "damage" jsonb;--> statement-breakpoint
ALTER TABLE "intergalactic_convoy_runs" ADD COLUMN "radiation_settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pirate_raids" ADD COLUMN "radiation_settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pirate_raids" ADD COLUMN "return_depart_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade_runs" ADD COLUMN "tech" jsonb;--> statement-breakpoint
ALTER TABLE "trade_runs" ADD COLUMN "damage" jsonb;--> statement-breakpoint
ALTER TABLE "trade_runs" ADD COLUMN "radiation_settled_at" timestamp with time zone;
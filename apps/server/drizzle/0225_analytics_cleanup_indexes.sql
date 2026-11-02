CREATE INDEX "analytics_visitors_created_idx" ON "analytics_visitors" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "build_orders_analytics_visit_idx" ON "build_orders" USING btree ("analytics_visit_hash") WHERE "build_orders"."analytics_visit_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "mining_runs_analytics_visit_idx" ON "mining_runs" USING btree ("analytics_visit_hash") WHERE "mining_runs"."analytics_visit_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "missions_analytics_visit_idx" ON "missions" USING btree ("analytics_visit_hash") WHERE "missions"."analytics_visit_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "monument_waves_analytics_visit_idx" ON "monument_waves" USING btree ("analytics_visit_hash") WHERE "monument_waves"."analytics_visit_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "paid_alerts_analytics_settled_idx" ON "paid_alerts" USING btree ("settled_at") WHERE "paid_alerts"."settled_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "pirate_raids_analytics_visit_idx" ON "pirate_raids" USING btree ("analytics_visit_hash") WHERE "pirate_raids"."analytics_visit_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "research_orders_analytics_visit_idx" ON "research_orders" USING btree ("analytics_visit_hash") WHERE "research_orders"."analytics_visit_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "trade_runs_analytics_visit_idx" ON "trade_runs" USING btree ("analytics_visit_hash") WHERE "trade_runs"."analytics_visit_hash" IS NOT NULL;
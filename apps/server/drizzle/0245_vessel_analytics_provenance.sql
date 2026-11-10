ALTER TABLE "vessel_missions" ADD COLUMN "ordered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vessel_missions" ADD COLUMN "analytics_visit_hash" text;--> statement-breakpoint
ALTER TABLE "vessel_missions" ADD COLUMN "analytics_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "vessel_orders" ADD COLUMN "ordered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vessel_orders" ADD COLUMN "analytics_visit_hash" text;--> statement-breakpoint
ALTER TABLE "vessel_orders" ADD COLUMN "analytics_attempt_id" uuid;--> statement-breakpoint
CREATE INDEX "vessel_missions_analytics_order_idx" ON "vessel_missions" USING btree ("ordered_at") WHERE "vessel_missions"."analytics_visit_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "vessel_missions_analytics_visit_idx" ON "vessel_missions" USING btree ("analytics_visit_hash") WHERE "vessel_missions"."analytics_visit_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "vessel_orders_analytics_order_idx" ON "vessel_orders" USING btree ("ordered_at") WHERE "vessel_orders"."analytics_visit_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "vessel_orders_analytics_visit_idx" ON "vessel_orders" USING btree ("analytics_visit_hash") WHERE "vessel_orders"."analytics_visit_hash" IS NOT NULL;
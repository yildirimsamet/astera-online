ALTER TABLE "players" ADD COLUMN "last_progress_at" timestamp with time zone;--> statement-breakpoint
-- D212 backfill: no history records when an order was GIVEN (build_orders.started_at is the queue
-- start), so every seated commander is credited with their last login. Anyone already gone 30
-- hours leaves on the first sweeps; everyone else has 30 hours from that login.
UPDATE "players" SET "last_progress_at" = "last_active_at";

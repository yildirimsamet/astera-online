-- A season's planned deadline is not necessarily when an operator ended it.
-- These nullable markers preserve that distinction without inventing facts for
-- historical rows. `status = frozen` remains the atomic proof that sealing ran.
ALTER TABLE "seasons" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "end_reason" text;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_end_reason_check"
  CHECK ("end_reason" IS NULL OR "end_reason" IN ('SCHEDULED_END', 'FORCED_WIPE'));--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_close_pair_check"
  CHECK (("closed_at" IS NULL AND "end_reason" IS NULL)
      OR ("closed_at" IS NOT NULL AND "end_reason" IS NOT NULL));

--
-- D151. A world's record is what its observer LAST HAD EYES ON, not what a probe
-- once saw. `probe_world_memories` therefore stops being a pointer into
-- `probe_reports` and starts carrying the silhouette itself: a raiding fleet has
-- no report behind it, only the fact that it was there.
--
ALTER TABLE "probe_world_memories" ALTER COLUMN "report_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "probe_world_memories" ADD COLUMN "source" text DEFAULT 'PROBE' NOT NULL;--> statement-breakpoint
--
-- ADDED NULLABLE, BACKFILLED, THEN TIGHTENED, for the reason 0052 states: drizzle
-- writes this as a bare `ADD COLUMN ... NOT NULL`, which cannot run against a
-- table that already has rows — and this one does on any live season. Every
-- existing row was written by a delivered probe, so its silhouette is that
-- report's.
--
ALTER TABLE "probe_world_memories" ADD COLUMN "silhouette" jsonb;--> statement-breakpoint
UPDATE "probe_world_memories" AS m
   SET "silhouette" = r."silhouette"
  FROM "probe_reports" AS r
 WHERE r."id" = m."report_id";--> statement-breakpoint
--
-- A memory whose report predates D127 carries no silhouette at all, and
-- `/api/galaxy` has always skipped exactly those rows (`if (!row.silhouette)
-- continue`). They draw nothing today, and keeping them would make the column
-- nullable for ever to hold data no surface reads.
--
DELETE FROM "probe_world_memories" WHERE "silhouette" IS NULL;--> statement-breakpoint
ALTER TABLE "probe_world_memories" ALTER COLUMN "silhouette" SET NOT NULL;

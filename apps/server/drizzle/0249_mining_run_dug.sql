ALTER TABLE "vessel_missions" ADD COLUMN "dug" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- A run that dug before this deploy and is still on its way home (code review 2026-11-13). A recall
-- turns the flight at that instant (depart = arrive); a dig keeps the outbound leg behind it.
UPDATE "vessel_missions" SET "dug" = true
WHERE "kind" = 'MINE' AND "status" = 'RETURNING' AND "depart_at" < "arrive_at" AND NOT "dug";

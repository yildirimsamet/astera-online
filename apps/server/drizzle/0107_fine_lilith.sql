-- Deuterium paid at launch. See `missions.fuelPaid` for why it is stored rather than re-derived.
--
-- THREE STEPS BECAUSE THE TABLE HAS ROWS. A bare `ADD COLUMN ... NOT NULL` with no default is
-- refused by Postgres on a populated table, and `missions` is never cleared — it has no cascade
-- from `seasons` and every past cycle's flights are still here.
--
-- THE BACKFILL IS 0 AND IT MEANS "UNRECORDED", NOT "FREE". Nothing measured fuel before this
-- column existed and it cannot be recovered: recomputing it from `fleet` and `distance` would use
-- TODAY's rate constants against a flight that paid yesterday's. Rows created before this
-- migration are therefore not admissible to the raid ledger; the column's docblock says so.
ALTER TABLE "missions" ADD COLUMN "fuel_paid" real;--> statement-breakpoint
UPDATE "missions" SET "fuel_paid" = 0 WHERE "fuel_paid" IS NULL;--> statement-breakpoint
ALTER TABLE "missions" ALTER COLUMN "fuel_paid" SET NOT NULL;

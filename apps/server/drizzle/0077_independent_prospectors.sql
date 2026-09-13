-- Independent craft may share a target. Existing code remains schema-compatible:
-- it still validates the old target restriction in its own launch transaction.
DROP INDEX IF EXISTS "mining_planet_rock_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "mining_planet_debris_idx";

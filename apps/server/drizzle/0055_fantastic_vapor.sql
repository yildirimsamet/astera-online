--
-- D156. The galaxy learns a second public event, and the calendar learns to count
-- each lane separately.
--
-- THE ENUM VALUES ARE ADDED HERE AND USED NOWHERE IN THIS FILE, WHICH IS WHAT
-- MAKES THEM SAFE. Postgres has allowed `ALTER TYPE ... ADD VALUE` inside a
-- transaction block since 12 (we run 16), but the new value still may not be USED
-- in the transaction that created it — and drizzle's migrator runs one file as one
-- transaction. So this migration only widens the two types; the table that would
-- reference them, and every row that carries `'TRADE_SHIP'`, land in 0056. This is
-- also what 0051 did when the pirate lane added `pirate_arrival`/`pirate_return`.
--
ALTER TYPE "public"."event_kind" ADD VALUE 'trade_arrival';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'trade_return';--> statement-breakpoint
ALTER TYPE "public"."galaxy_event_occurrence_kind" ADD VALUE 'TRADE_SHIP';--> statement-breakpoint
--
-- ONE NUMBER ONE PER LANE. `sequence` counts each kind's own occurrences from
-- zero, so on `(season_id, sequence)` the first merchant of a season collided with
-- the first shower and took the whole season-creation transaction down with it.
--
-- No backfill: every existing row is an ASTEROID_SHOWER, and adding `kind` to a
-- unique index can only ever relax it.
--
DROP INDEX "galaxy_event_occurrences_season_sequence_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "galaxy_event_occurrences_season_kind_sequence_idx" ON "galaxy_event_occurrences" USING btree ("season_id","kind","sequence");
--
-- REMOVED FROM THE GENERATED OUTPUT: `ALTER TABLE "pirate_raids" ADD COLUMN
-- "owner_player_id" uuid NOT NULL` and its foreign key.
--
-- 0054 added that column by hand and wrote its own journal entry without a
-- matching `meta/0054_snapshot.json`, so drizzle-kit diffed this schema against
-- 0053's snapshot and re-proposed a column the database already has. Applying it
-- would fail on every migrated database with "column already exists". The
-- snapshot written beside THIS migration does contain the column, so the phantom
-- is a one-time artefact and does not recur.
--

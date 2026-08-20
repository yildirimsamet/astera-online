-- D21 · named accounts, ten galaxies, one planet each.
--
-- Hand-finished after generation. Every ADD COLUMN below is NOT NULL, and three of
-- the new constraints are UNIQUE, so the generated form only applies to an empty
-- database — it would fail on the first row of any real one. Written out as
-- add-nullable → backfill → constrain so it runs on a database that has been
-- played in.

--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "password_hash" text;--> statement-breakpoint

-- Accounts that predate D21 were guests: no name, no password, and reachable only
-- from the browser that minted them. They are given a name derived from their id
-- and a password hash that cannot verify — `verifyPassword` rejects anything that
-- is not a six-field scrypt record — so they keep their planets and their history
-- and simply cannot be signed into. That is what removing the guest door means;
-- pretending otherwise would mean inventing a password for somebody.
UPDATE "accounts"
   SET "username" = 'legacy_' || substr(replace("id"::text, '-', ''), 1, 12)
 WHERE "username" IS NULL;--> statement-breakpoint
UPDATE "accounts" SET "password_hash" = 'disabled' WHERE "password_hash" IS NULL;--> statement-breakpoint

ALTER TABLE "accounts" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "password_hash" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_username_idx" ON "accounts" USING btree ("username");--> statement-breakpoint

ALTER TABLE "shards" ADD COLUMN "name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "shards" ADD COLUMN "ordinal" integer;--> statement-breakpoint
ALTER TABLE "shards" ALTER COLUMN "player_cap" SET DEFAULT 50;--> statement-breakpoint

-- Fill order. Existing shards are numbered by code so the ordering is stable and
-- the unique index below can be created; `bootstrapServers` renumbers the ten real
-- galaxies to 1..10 the next time it runs.
UPDATE "shards" AS s
   SET "ordinal" = n.rn
  FROM (SELECT "id", row_number() OVER (ORDER BY "code") AS rn FROM "shards") AS n
 WHERE s."id" = n."id" AND s."ordinal" IS NULL;--> statement-breakpoint

ALTER TABLE "shards" ALTER COLUMN "ordinal" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "shards" ALTER COLUMN "ordinal" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "shards_ordinal_idx" ON "shards" USING btree ("ordinal");--> statement-breakpoint

ALTER TABLE "players" ADD COLUMN "last_active_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint

-- ONE ACCOUNT, ONE PLANET, ONE GALAXY.
--
-- This replaces the (account, season) index, which permitted one player row per
-- season and therefore ten planets across ten galaxies. If an account already holds
-- two, this statement FAILS and the migration stops — deliberately. The alternative
-- is choosing which of somebody's two planets to delete, and a migration must never
-- make that call silently.
DROP INDEX "players_account_season_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "players_account_idx" ON "players" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "players_active_idx" ON "players" USING btree ("season_id","last_active_at");

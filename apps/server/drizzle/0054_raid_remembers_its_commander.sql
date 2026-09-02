--
-- A PIRATE RAID REMEMBERS WHO SENT IT.
--
-- The return leg resolved its destination from `planets.controller_player_id` on
-- the origin world, which is the wrong question the moment that world changes
-- hands mid-flight: a colony taken while the squadron is away delivered the
-- fleet, the hoard and the towed hull to the commander who had just captured it.
-- Every other return leg in the game already resolves through
-- `safeHomePlanet(owner_player_id, origin_planet_id)`; this column is what lets
-- this lane ask the same question.
--
-- ADDED NULLABLE, BACKFILLED, THEN TIGHTENED. Drizzle writes a bare
-- `ADD COLUMN ... NOT NULL`, which cannot run against a table that already has
-- rows, and a live season has them. Every existing raid was launched by the
-- commander who controls its origin world right now — no in-flight raid can have
-- outlived a capture yet, because until this migration the capture would have
-- rewritten the delivery rather than the record.
--
ALTER TABLE "pirate_raids" ADD COLUMN "owner_player_id" uuid;--> statement-breakpoint
UPDATE "pirate_raids" AS r
   -- `planets` names its controller column `player_id`; the Drizzle field is
   -- `controllerPlayerId`. This is SQL, so it is the physical name that counts.
   SET "owner_player_id" = p."player_id"
  FROM "planets" AS p
 WHERE p."id" = r."planet_id";--> statement-breakpoint
--
-- A raid whose origin has no controller at all cannot be delivered to anybody and
-- has no commander to name. `reclaim` already deletes raids off a released world,
-- so this can only be a row that outlived its world by some other route.
--
DELETE FROM "pirate_raids" WHERE "owner_player_id" IS NULL;--> statement-breakpoint
ALTER TABLE "pirate_raids" ALTER COLUMN "owner_player_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pirate_raids" ADD CONSTRAINT "pirate_raids_owner_player_id_players_id_fk"
  FOREIGN KEY ("owner_player_id") REFERENCES "public"."players"("id")
  ON DELETE no action ON UPDATE no action;

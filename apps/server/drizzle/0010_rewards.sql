CREATE TABLE "reward_grants" (
	"player_id" uuid NOT NULL,
	"reward_id" text NOT NULL,
	"alloy" real DEFAULT 0 NOT NULL,
	"crystal" real DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reward_grants_player_id_reward_id_pk" PRIMARY KEY("player_id","reward_id")
);
--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "built_ever" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_grants" ADD CONSTRAINT "reward_grants_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
--
-- BACKFILL, SO THE LIVE GALAXY IS NOT PUNISHED FOR BEING FIRST.
--
-- `built_ever` starts empty, and on a fresh database that is correct. On THIS
-- database it is not: there are commanders who have been playing for days and
-- would open the reward panel to find the ships chain reading 0 of 5 with three
-- squadrons standing on their world.
--
-- What every planet is holding now is a FLOOR on what it has built — nothing
-- creates a hull except the shipyard, and the two Wasps of the opening grant are
-- the single exception, which errs by two in the player's favour exactly once.
-- Losses are not recoverable and are not guessed at: this under-counts a veteran
-- and never over-counts one, which is the right direction for a number that
-- unlocks a payment.
--
-- Home and away alike. A squadron in the air was still built here.
--
UPDATE "planets" p SET "built_ever" = sub.tally
FROM (
  SELECT "planet_id", jsonb_object_agg("hull", total) AS tally
  FROM (
    SELECT "planet_id", "hull", SUM("count")::int AS total
    FROM "units" GROUP BY "planet_id", "hull" HAVING SUM("count") > 0
  ) t GROUP BY "planet_id"
) sub
WHERE p."id" = sub."planet_id";

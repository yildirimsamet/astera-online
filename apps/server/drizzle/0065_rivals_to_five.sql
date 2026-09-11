CREATE TABLE "player_rivals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"planet_id" uuid NOT NULL,
	"target_player_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_rivals" ADD CONSTRAINT "player_rivals_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_rivals_target_idx" ON "player_rivals" USING btree ("player_id","target_player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_rivals_slot_idx" ON "player_rivals" USING btree ("player_id","slot");--> statement-breakpoint
INSERT INTO "player_rivals" ("player_id", "planet_id", "target_player_id", "slot")
SELECT "id", "rival_planet_id", "rival_player_id", 0
FROM "players"
WHERE "rival_planet_id" IS NOT NULL AND "rival_player_id" IS NOT NULL;--> statement-breakpoint
--
-- THE OLD COLUMNS ARE LEFT IN PLACE ON PURPOSE. D183 · deployment rule 5.
--
-- `players.rival_planet_id` and `players.rival_player_id` are no longer read or
-- written by any code in this build — the rows above are the whole of the feature
-- now. Dropping them here would make this a CONTRACTION, and a contraction is the
-- one kind of migration an old replica cannot survive: it would query a column
-- that is gone for the length of the rollout, which is exactly what
-- `docs/deployment.md` rule 5 forces a stop for.
--
-- Expand-only means this release rolls without one. The columns carry no meaning
-- and cost two nullable uuids per player; a later release may drop them once no
-- deployed image reads them, which is the second half of expand/contract.
--
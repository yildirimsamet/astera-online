CREATE TABLE "player_research" (
	"player_id" uuid NOT NULL,
	"project_id" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "player_research_player_id_project_id_pk" PRIMARY KEY("player_id","project_id")
);
--> statement-breakpoint
ALTER TABLE "player_research" ADD CONSTRAINT "player_research_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- T7 BACKFILL. Research moves from the world to the commander, and nothing a
-- player has already paid for may be lost in the move.
--
-- The union of every project completed on any world this commander currently
-- controls, at level 1, keeping the EARLIEST completion so the date still means
-- "when you first held this". `planet_research` is left untouched: the copy is
-- one-way and idempotent, so a rollback still has its source.
--
-- A captured colony carries its previous owner's rows, so a capturer can inherit
-- research they did not buy. That is accepted deliberately: there is no ownership
-- history to distinguish a settled colony from a taken one, the case needs a
-- capture of a world holding research the capturer lacks, and the error only ever
-- GRANTS. Losing research a player paid for is the worse failure by a wide margin.
INSERT INTO "player_research" ("player_id", "project_id", "level", "completed_at")
SELECT p."player_id", pr."project_id", 1, MIN(pr."completed_at")
FROM "planet_research" pr
JOIN "planets" p ON p."id" = pr."planet_id"
WHERE p."player_id" IS NOT NULL
GROUP BY p."player_id", pr."project_id"
ON CONFLICT DO NOTHING;

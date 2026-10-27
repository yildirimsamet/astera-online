CREATE TABLE "arena_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"ready" boolean DEFAULT false NOT NULL,
	"fingerprint" text,
	"tactic" text DEFAULT 'smoke' NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"released_at" timestamp with time zone,
	"sortie_id" uuid,
	"launch" jsonb,
	"connected_at" timestamp with time zone,
	"outcome" text,
	"extracted" jsonb DEFAULT '{"alloy":0,"crystal":0,"deuterium":0}'::jsonb NOT NULL,
	"share" jsonb,
	"claimed_at" timestamp with time zone,
	"receipt" jsonb,
	CONSTRAINT "arena_team_members_tactic_check" CHECK ("arena_team_members"."tactic" IN ('smoke', 'cloak', 'illusion', 'radar')),
	CONSTRAINT "arena_team_members_outcome_check" CHECK ("arena_team_members"."outcome" IS NULL OR "arena_team_members"."outcome" IN ('extracted', 'dead', 'towed', 'recalled', 'test'))
);
--> statement-breakpoint
CREATE TABLE "arena_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"clan_id" uuid NOT NULL,
	"solo" boolean DEFAULT false NOT NULL,
	"state" text DEFAULT 'forming' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "arena_teams_state_check" CHECK ("arena_teams"."state" IN ('forming', 'flying', 'finished', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "arena_team_members" ADD CONSTRAINT "arena_team_members_team_id_arena_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."arena_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_team_members" ADD CONSTRAINT "arena_team_members_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_teams" ADD CONSTRAINT "arena_teams_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_teams" ADD CONSTRAINT "arena_teams_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "arena_team_members_roster_idx" ON "arena_team_members" USING btree ("team_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "arena_team_members_active_player_idx" ON "arena_team_members" USING btree ("player_id") WHERE "arena_team_members"."released_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "arena_team_members_sortie_idx" ON "arena_team_members" USING btree ("sortie_id") WHERE "arena_team_members"."sortie_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "arena_team_members_claim_idx" ON "arena_team_members" USING btree ("player_id","claimed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "arena_teams_active_clan_idx" ON "arena_teams" USING btree ("clan_id") WHERE "arena_teams"."state" IN ('forming', 'flying');--> statement-breakpoint
CREATE INDEX "arena_teams_season_state_idx" ON "arena_teams" USING btree ("season_id","state");
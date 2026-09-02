CREATE TABLE "pirate_state" (
	"season_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"losses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"destroyed_at" timestamp with time zone,
	"destroyed_by_player_id" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "pirate_state_season_id_index_pk" PRIMARY KEY("season_id","index")
);
--> statement-breakpoint
ALTER TABLE "pirate_state" ADD CONSTRAINT "pirate_state_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pirate_state" ADD CONSTRAINT "pirate_state_destroyed_by_player_id_players_id_fk" FOREIGN KEY ("destroyed_by_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
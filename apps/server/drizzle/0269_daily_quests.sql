CREATE TABLE "daily_quest_claims" (
	"player_id" uuid NOT NULL,
	"day" text NOT NULL,
	"quest_id" text NOT NULL,
	"alloy" real DEFAULT 0 NOT NULL,
	"crystal" real DEFAULT 0 NOT NULL,
	"honor_micros" integer NOT NULL,
	"claimed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "daily_quest_claims_player_id_day_quest_id_pk" PRIMARY KEY("player_id","day","quest_id")
);
--> statement-breakpoint
CREATE TABLE "honor_quest_totals" (
	"season_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"micros" bigint NOT NULL,
	CONSTRAINT "honor_quest_totals_season_id_player_id_pk" PRIMARY KEY("season_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "arena_ships" ADD COLUMN "last_sortie_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_quest_claims" ADD CONSTRAINT "daily_quest_claims_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honor_quest_totals" ADD CONSTRAINT "honor_quest_totals_season_id_honor_seasons_season_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."honor_seasons"("season_id") ON DELETE cascade ON UPDATE no action;
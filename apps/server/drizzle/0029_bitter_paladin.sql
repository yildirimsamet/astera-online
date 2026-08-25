CREATE TABLE "strategic_impacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"mission_id" uuid NOT NULL,
	"attacker_player_id" uuid NOT NULL,
	"defender_player_id" uuid,
	"target_planet_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"damage" real DEFAULT 0 NOT NULL,
	"destroyed_fleet" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "strategic_impacts" ADD CONSTRAINT "strategic_impacts_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_impacts" ADD CONSTRAINT "strategic_impacts_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_impacts" ADD CONSTRAINT "strategic_impacts_attacker_player_id_players_id_fk" FOREIGN KEY ("attacker_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_impacts" ADD CONSTRAINT "strategic_impacts_defender_player_id_players_id_fk" FOREIGN KEY ("defender_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_impacts" ADD CONSTRAINT "strategic_impacts_target_planet_id_planets_id_fk" FOREIGN KEY ("target_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "strategic_impacts_mission_idx" ON "strategic_impacts" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "strategic_impacts_attacker_idx" ON "strategic_impacts" USING btree ("attacker_player_id","created_at");--> statement-breakpoint
CREATE INDEX "strategic_impacts_defender_idx" ON "strategic_impacts" USING btree ("defender_player_id","created_at");
-- AY F3a (§4.1, §6.6): planet ↔ moon hops. JUMP, fuel and the cancelled/lost states arrive with the gate (F4, V31).
CREATE TABLE "moon_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"owner_player_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"from_planet_id" uuid NOT NULL,
	"to_planet_id" uuid NOT NULL,
	"fleet" jsonb NOT NULL,
	"damage" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"depart_at" timestamp with time zone NOT NULL,
	"arrive_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	CONSTRAINT "moon_moves_kind_check" CHECK ("moon_moves"."kind" in ('HOP_UP', 'HOP_DOWN')),
	CONSTRAINT "moon_moves_status_check" CHECK ("moon_moves"."status" in ('PENDING', 'LANDED', 'RETURNED'))
);
--> statement-breakpoint
ALTER TABLE "moon_moves" ADD CONSTRAINT "moon_moves_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moon_moves" ADD CONSTRAINT "moon_moves_owner_player_id_players_id_fk" FOREIGN KEY ("owner_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moon_moves" ADD CONSTRAINT "moon_moves_from_planet_id_planets_id_fk" FOREIGN KEY ("from_planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moon_moves" ADD CONSTRAINT "moon_moves_to_planet_id_planets_id_fk" FOREIGN KEY ("to_planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moon_moves_owner_idx" ON "moon_moves" USING btree ("owner_player_id");--> statement-breakpoint
CREATE INDEX "moon_moves_from_pending_idx" ON "moon_moves" USING btree ("from_planet_id") WHERE "moon_moves"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "moon_moves_to_pending_idx" ON "moon_moves" USING btree ("to_planet_id") WHERE "moon_moves"."status" = 'PENDING';
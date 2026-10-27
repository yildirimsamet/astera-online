CREATE TABLE "arena_ships" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"ship" text NOT NULL,
	"chosen_at" timestamp with time zone NOT NULL,
	"changed_at" timestamp with time zone,
	"fuel" double precision NOT NULL,
	"ammo" double precision NOT NULL,
	"hold_alloy" double precision DEFAULT 0 NOT NULL,
	"hold_crystal" double precision DEFAULT 0 NOT NULL,
	"hold_deuterium" double precision DEFAULT 0 NOT NULL,
	"ready_at" timestamp with time zone,
	"ready_reason" text,
	"sortie_id" uuid,
	"transfer_day" text,
	"sent_alloy" double precision DEFAULT 0 NOT NULL,
	"sent_crystal" double precision DEFAULT 0 NOT NULL,
	"sent_deuterium" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "arena_ships_ship_check" CHECK ("arena_ships"."ship" IN ('akinci', 'muhafiz', 'kilavuz')),
	CONSTRAINT "arena_ships_ready_check" CHECK (("arena_ships"."ready_at" IS NULL) = ("arena_ships"."ready_reason" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "arena_ships" ADD CONSTRAINT "arena_ships_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
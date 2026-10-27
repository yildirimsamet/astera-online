CREATE TABLE "arena_admiral_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admiral_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "arena_admiral_leg_kind_check" CHECK ("arena_admiral_legs"."kind" IN ('mission','pirate','mining','trade','convoy','monument','signal','defence'))
);
--> statement-breakpoint
CREATE TABLE "arena_admirals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"ship" text NOT NULL,
	"level" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"fought" boolean DEFAULT false NOT NULL,
	"won" boolean DEFAULT false NOT NULL,
	"landed_ships" integer DEFAULT 0 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "arena_admirals_state_check" CHECK ("arena_admirals"."status" IN ('active','returned') AND "arena_admirals"."level" BETWEEN 1 AND 20 AND "arena_admirals"."landed_ships" >= 0 AND "arena_admirals"."xp" >= 0),
	CONSTRAINT "arena_admirals_ship_check" CHECK ("arena_admirals"."ship" IN ('akinci','muhafiz','kilavuz'))
);
--> statement-breakpoint
ALTER TABLE "arena_ships" ADD COLUMN "admiral_id" uuid;--> statement-breakpoint
ALTER TABLE "arena_admiral_legs" ADD CONSTRAINT "arena_admiral_legs_admiral_id_arena_admirals_id_fk" FOREIGN KEY ("admiral_id") REFERENCES "public"."arena_admirals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_admirals" ADD CONSTRAINT "arena_admirals_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_admirals" ADD CONSTRAINT "arena_admirals_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "arena_admiral_leg_ref_idx" ON "arena_admiral_legs" USING btree ("kind","ref_id");--> statement-breakpoint
CREATE INDEX "arena_admiral_leg_task_idx" ON "arena_admiral_legs" USING btree ("admiral_id");--> statement-breakpoint
CREATE UNIQUE INDEX "arena_admirals_active_player_idx" ON "arena_admirals" USING btree ("player_id") WHERE "arena_admirals"."status" = 'active';
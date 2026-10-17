ALTER TYPE "public"."event_kind" ADD VALUE 'unknown_signal_spawn';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'unknown_signal_expire';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'unknown_signal_arrival';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'unknown_signal_return';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'unknown_signal_result';--> statement-breakpoint
CREATE TABLE "unknown_signal_state" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"season_id" uuid NOT NULL,
	"next_at" timestamp with time zone,
	"sequence" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unknown_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"seed" text NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"z" double precision NOT NULL,
	"appeared_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"origin_planet_id" uuid,
	"origin" jsonb,
	"fleet" jsonb,
	"tech" jsonb,
	"damage" jsonb,
	"tier_at_dispatch" integer,
	"depart_at" timestamp with time zone,
	"arrive_at" timestamp with time zone,
	"return_depart_at" timestamp with time zone,
	"return_at" timestamp with time zone,
	"recalled_at" timestamp with time zone,
	"radiation_settled_at" timestamp with time zone,
	"outcome" jsonb,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unknown_signals_status_check" CHECK ("unknown_signals"."status" in ('open','outbound','returning','done','expired','recalled','lost'))
);
--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "signal_boost_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "unknown_signal_state" ADD CONSTRAINT "unknown_signal_state_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unknown_signal_state" ADD CONSTRAINT "unknown_signal_state_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unknown_signals" ADD CONSTRAINT "unknown_signals_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unknown_signals" ADD CONSTRAINT "unknown_signals_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unknown_signals" ADD CONSTRAINT "unknown_signals_origin_planet_id_planets_id_fk" FOREIGN KEY ("origin_planet_id") REFERENCES "public"."planets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "unknown_signal_state_next_idx" ON "unknown_signal_state" USING btree ("next_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unknown_signals_one_open_idx" ON "unknown_signals" USING btree ("player_id") WHERE "unknown_signals"."status" = 'open';--> statement-breakpoint
CREATE INDEX "unknown_signals_owner_idx" ON "unknown_signals" USING btree ("player_id","status","appeared_at");--> statement-breakpoint
CREATE INDEX "unknown_signals_origin_idx" ON "unknown_signals" USING btree ("origin_planet_id","status");--> statement-breakpoint
CREATE INDEX "unknown_signals_season_idx" ON "unknown_signals" USING btree ("season_id","status");
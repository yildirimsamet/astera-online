ALTER TYPE "public"."notification_kind" ADD VALUE 'clan_alarm';--> statement-breakpoint
CREATE TABLE "clan_alarms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"clan_id" uuid NOT NULL,
	"mission_id" uuid NOT NULL,
	"host_player_id" uuid NOT NULL,
	"host_planet_id" uuid NOT NULL,
	"arrive_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clan_messages" DROP CONSTRAINT "clan_messages_content_check";--> statement-breakpoint
ALTER TABLE "clan_treasury_events" DROP CONSTRAINT "clan_treasury_events_kind_check";--> statement-breakpoint
ALTER TABLE "clan_treasury_events" DROP CONSTRAINT "clan_treasury_events_shape_check";--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "clan_purse" jsonb;--> statement-breakpoint
ALTER TABLE "clan_messages" ADD COLUMN "event" jsonb;--> statement-breakpoint
ALTER TABLE "clan_support_waves" ADD COLUMN "alarm_id" uuid;--> statement-breakpoint
ALTER TABLE "probe_reports" ADD COLUMN "clan_level" integer;--> statement-breakpoint
ALTER TABLE "clan_alarms" ADD CONSTRAINT "clan_alarms_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_alarms" ADD CONSTRAINT "clan_alarms_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_alarms" ADD CONSTRAINT "clan_alarms_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_alarms" ADD CONSTRAINT "clan_alarms_host_player_id_players_id_fk" FOREIGN KEY ("host_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_alarms" ADD CONSTRAINT "clan_alarms_host_planet_id_planets_id_fk" FOREIGN KEY ("host_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clan_alarms_mission_uq" ON "clan_alarms" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "clan_alarms_clan_idx" ON "clan_alarms" USING btree ("clan_id","created_at");--> statement-breakpoint
CREATE INDEX "clan_alarms_host_player_idx" ON "clan_alarms" USING btree ("host_player_id");--> statement-breakpoint
CREATE INDEX "clan_alarms_host_planet_idx" ON "clan_alarms" USING btree ("host_planet_id");--> statement-breakpoint
ALTER TABLE "clan_support_waves" ADD CONSTRAINT "clan_support_waves_alarm_id_clan_alarms_id_fk" FOREIGN KEY ("alarm_id") REFERENCES "public"."clan_alarms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clan_support_waves_alarm_idx" ON "clan_support_waves" USING btree ("alarm_id");--> statement-breakpoint
ALTER TABLE "clan_messages" ADD CONSTRAINT "clan_messages_content_check" CHECK (char_length(btrim("clan_messages"."content")) <= 280 AND (char_length(btrim("clan_messages"."content")) >= 1 OR "clan_messages"."media" IS NOT NULL OR "clan_messages"."event" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "clan_treasury_events" ADD CONSTRAINT "clan_treasury_events_kind_check" CHECK ("clan_treasury_events"."kind" IN ('DONATION', 'LEVEL_UP', 'DISBAND_BURN', 'VICTORY_WRECK'));--> statement-breakpoint
ALTER TABLE "clan_treasury_events" ADD CONSTRAINT "clan_treasury_events_shape_check" CHECK (CASE "clan_treasury_events"."kind"
          WHEN 'DONATION' THEN "clan_treasury_events"."actor_player_id" IS NOT NULL
            AND "clan_treasury_events"."source_planet_id" IS NOT NULL
            AND "clan_treasury_events"."alloy" >= 0 AND "clan_treasury_events"."crystal" >= 0 AND "clan_treasury_events"."deuterium" >= 0
            AND "clan_treasury_events"."alloy" + "clan_treasury_events"."crystal" + "clan_treasury_events"."deuterium" > 0
            AND "clan_treasury_events"."level_before" IS NULL AND "clan_treasury_events"."level_after" IS NULL
          WHEN 'LEVEL_UP' THEN "clan_treasury_events"."actor_player_id" IS NOT NULL
            AND "clan_treasury_events"."source_planet_id" IS NULL
            AND "clan_treasury_events"."alloy" <= 0 AND "clan_treasury_events"."crystal" <= 0 AND "clan_treasury_events"."deuterium" <= 0
            AND "clan_treasury_events"."level_before" BETWEEN 1 AND 9
            AND "clan_treasury_events"."level_after" = "clan_treasury_events"."level_before" + 1
          WHEN 'DISBAND_BURN' THEN "clan_treasury_events"."source_planet_id" IS NULL
            AND "clan_treasury_events"."alloy" <= 0 AND "clan_treasury_events"."crystal" <= 0 AND "clan_treasury_events"."deuterium" <= 0
            AND "clan_treasury_events"."level_before" IS NULL AND "clan_treasury_events"."level_after" IS NULL
          WHEN 'VICTORY_WRECK' THEN "clan_treasury_events"."actor_player_id" IS NULL
            AND "clan_treasury_events"."source_planet_id" IS NULL
            AND "clan_treasury_events"."alloy" >= 0 AND "clan_treasury_events"."crystal" >= 0 AND "clan_treasury_events"."deuterium" >= 0
            AND "clan_treasury_events"."alloy" + "clan_treasury_events"."crystal" + "clan_treasury_events"."deuterium" > 0
            AND "clan_treasury_events"."level_before" IS NULL AND "clan_treasury_events"."level_after" IS NULL
          ELSE false
        END);--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "clan_bonus" double precision DEFAULT 0 NOT NULL;

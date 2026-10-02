-- Klan Savunma Desteği (docs/clan-defense-support-plan.md). Expand-only.
-- The battle_reports CHECKs are re-added NOT VALID and validated apart, so the
-- relaxation never holds the table under an ACCESS EXCLUSIVE scan.
ALTER TYPE "public"."event_kind" ADD VALUE 'clan_support_expiry';--> statement-breakpoint
ALTER TYPE "public"."mission_kind" ADD VALUE 'clan_support';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'clan_support_inbound';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'clan_support_departed';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'clan_support_result';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'defence_posture_reset';--> statement-breakpoint
CREATE TABLE "clan_support_battle_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"role" text NOT NULL,
	"sent" jsonb NOT NULL,
	"losses" jsonb NOT NULL,
	"survivors" jsonb NOT NULL,
	"power" bigint DEFAULT 0 NOT NULL,
	"loss_value" bigint DEFAULT 0 NOT NULL,
	"damage" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"loot_lost" jsonb,
	"dominion_delta" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clan_support_battle_results_role_check" CHECK ("clan_support_battle_results"."role" IN ('HOST', 'SUPPORT')),
	CONSTRAINT "clan_support_battle_results_loot_check" CHECK ("clan_support_battle_results"."role" = 'HOST' OR "clan_support_battle_results"."loot_lost" IS NULL),
	CONSTRAINT "clan_support_battle_results_amounts_check" CHECK ("clan_support_battle_results"."power" >= 0 AND "clan_support_battle_results"."loss_value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "clan_support_dominion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"mission_id" uuid NOT NULL,
	"report_id" uuid,
	"player_id" uuid NOT NULL,
	"role" text NOT NULL,
	"ruleset_version" integer NOT NULL,
	"attacker_count" integer NOT NULL,
	"defender_count" integer NOT NULL,
	"base_exchange" bigint NOT NULL,
	"adjusted_transfer" bigint NOT NULL,
	"delta" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clan_support_dominion_events_role_check" CHECK ("clan_support_dominion_events"."role" IN ('ATTACKER', 'DEFENDER')),
	CONSTRAINT "clan_support_dominion_events_counts_check" CHECK ("clan_support_dominion_events"."attacker_count" >= 1 AND "clan_support_dominion_events"."defender_count" >= 2 AND "clan_support_dominion_events"."ruleset_version" > 0),
	CONSTRAINT "clan_support_dominion_events_range_check" CHECK ("clan_support_dominion_events"."base_exchange" BETWEEN -9007199254740991 AND 9007199254740991
      AND "clan_support_dominion_events"."adjusted_transfer" BETWEEN -9007199254740991 AND 9007199254740991
      AND "clan_support_dominion_events"."delta" BETWEEN -9007199254740991 AND 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "clan_support_waves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"clan_id" uuid NOT NULL,
	"sender_player_id" uuid NOT NULL,
	"host_player_id" uuid NOT NULL,
	"origin_planet_id" uuid NOT NULL,
	"host_planet_id" uuid NOT NULL,
	"unit_location" text NOT NULL,
	"fleet" jsonb NOT NULL,
	"damage" jsonb,
	"reserved_bulk" real NOT NULL,
	"fuel_paid" real NOT NULL,
	"status" text DEFAULT 'OUTBOUND' NOT NULL,
	"return_reason" text,
	"outbound_mission_id" uuid NOT NULL,
	"return_mission_id" uuid,
	"sent_at" timestamp with time zone NOT NULL,
	"arrive_at" timestamp with time zone NOT NULL,
	"stationed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"return_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"battles" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "clan_support_waves_status_check" CHECK ("clan_support_waves"."status" IN ('OUTBOUND', 'STATIONED', 'RETURNING', 'HOME', 'LOST')),
	CONSTRAINT "clan_support_waves_reason_check" CHECK ("clan_support_waves"."return_reason" IS NULL OR "clan_support_waves"."return_reason" IN ('RECALLED', 'SENT_BACK',
      'HOST_CLOSED', 'EXPIRED', 'BAND', 'MEMBERSHIP', 'WORLD_CHANGED', 'FREEZE')),
	CONSTRAINT "clan_support_waves_self_check" CHECK ("clan_support_waves"."sender_player_id" <> "clan_support_waves"."host_player_id"),
	CONSTRAINT "clan_support_waves_amounts_check" CHECK ("clan_support_waves"."reserved_bulk" >= 0 AND "clan_support_waves"."fuel_paid" >= 0 AND "clan_support_waves"."battles" >= 0),
	CONSTRAINT "clan_support_waves_lifecycle_check" CHECK (("clan_support_waves"."status" <> 'STATIONED'
          OR ("clan_support_waves"."stationed_at" IS NOT NULL AND "clan_support_waves"."expires_at" IS NOT NULL))
      AND ("clan_support_waves"."status" <> 'RETURNING'
          OR ("clan_support_waves"."return_at" IS NOT NULL AND "clan_support_waves"."return_reason" IS NOT NULL))
      AND ("clan_support_waves"."status" NOT IN ('HOME', 'LOST') OR "clan_support_waves"."resolved_at" IS NOT NULL)
      AND ("clan_support_waves"."expires_at" IS NULL OR "clan_support_waves"."stationed_at" IS NULL
          OR "clan_support_waves"."expires_at" >= "clan_support_waves"."stationed_at"))
);
--> statement-breakpoint
ALTER TABLE "battle_reports" DROP CONSTRAINT "battle_reports_dominion_audit_check";--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "defender_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "defence_posture" text DEFAULT 'ESCAPE' NOT NULL;--> statement-breakpoint
ALTER TABLE "probe_reports" ADD COLUMN "posture" text;--> statement-breakpoint
ALTER TABLE "probe_reports" ADD COLUMN "support" jsonb;--> statement-breakpoint
ALTER TABLE "clan_support_battle_results" ADD CONSTRAINT "clan_support_battle_results_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_support_battle_results" ADD CONSTRAINT "clan_support_battle_results_report_id_battle_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."battle_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_support_dominion_events" ADD CONSTRAINT "clan_support_dominion_events_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_support_waves" ADD CONSTRAINT "clan_support_waves_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_support_waves" ADD CONSTRAINT "clan_support_waves_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_support_waves" ADD CONSTRAINT "clan_support_waves_sender_player_id_players_id_fk" FOREIGN KEY ("sender_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_support_waves" ADD CONSTRAINT "clan_support_waves_host_player_id_players_id_fk" FOREIGN KEY ("host_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_support_waves" ADD CONSTRAINT "clan_support_waves_origin_planet_id_planets_id_fk" FOREIGN KEY ("origin_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_support_waves" ADD CONSTRAINT "clan_support_waves_host_planet_id_planets_id_fk" FOREIGN KEY ("host_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_support_waves" ADD CONSTRAINT "clan_support_waves_outbound_mission_id_missions_id_fk" FOREIGN KEY ("outbound_mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_support_waves" ADD CONSTRAINT "clan_support_waves_return_mission_id_missions_id_fk" FOREIGN KEY ("return_mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clan_support_battle_results_report_player_idx" ON "clan_support_battle_results" USING btree ("report_id","player_id");--> statement-breakpoint
CREATE INDEX "clan_support_battle_results_player_idx" ON "clan_support_battle_results" USING btree ("player_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_support_dominion_events_idx" ON "clan_support_dominion_events" USING btree ("mission_id","player_id","role");--> statement-breakpoint
CREATE INDEX "clan_support_dominion_events_season_idx" ON "clan_support_dominion_events" USING btree ("season_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_support_waves_unit_location_idx" ON "clan_support_waves" USING btree ("unit_location");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_support_waves_outbound_idx" ON "clan_support_waves" USING btree ("outbound_mission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_support_waves_return_idx" ON "clan_support_waves" USING btree ("return_mission_id");--> statement-breakpoint
CREATE INDEX "clan_support_waves_host_idx" ON "clan_support_waves" USING btree ("host_planet_id","status");--> statement-breakpoint
CREATE INDEX "clan_support_waves_sender_idx" ON "clan_support_waves" USING btree ("sender_player_id","status");--> statement-breakpoint
CREATE INDEX "clan_support_waves_origin_idx" ON "clan_support_waves" USING btree ("origin_planet_id","status");--> statement-breakpoint
CREATE INDEX "clan_support_waves_host_player_idx" ON "clan_support_waves" USING btree ("host_player_id","status");--> statement-breakpoint
CREATE INDEX "clan_support_waves_season_idx" ON "clan_support_waves" USING btree ("season_id");--> statement-breakpoint
ALTER TABLE "battle_reports" ADD CONSTRAINT "battle_reports_defender_count_check" CHECK ("battle_reports"."defender_count" >= 1) NOT VALID;--> statement-breakpoint
ALTER TABLE "battle_reports" VALIDATE CONSTRAINT "battle_reports_defender_count_check";--> statement-breakpoint
ALTER TABLE "battle_reports" ADD CONSTRAINT "battle_reports_dominion_audit_check" CHECK (("battle_reports"."dominion_eligible" IS NULL
          AND "battle_reports"."dominion_rule_version" IS NULL
          AND "battle_reports"."dominion_loot_value" IS NULL
          AND "battle_reports"."dominion_attacker_loss_value" IS NULL
          AND "battle_reports"."dominion_defender_loss_value" IS NULL
          AND "battle_reports"."dominion_raw_exchange" IS NULL)
        OR ("battle_reports"."dominion_eligible" = false
          AND "battle_reports"."target_kind" = 'PLAYER'
          AND "battle_reports"."dominion_swing" = 0
          AND "battle_reports"."dominion_rule_version" IS NULL
          AND "battle_reports"."dominion_loot_value" IS NULL
          AND "battle_reports"."dominion_attacker_loss_value" IS NULL
          AND "battle_reports"."dominion_defender_loss_value" IS NULL
          AND "battle_reports"."dominion_raw_exchange" IS NULL)
        OR ("battle_reports"."dominion_eligible" = true
          AND "battle_reports"."target_kind" = 'PLAYER'
          AND "battle_reports"."dominion_rule_version" > 0
          AND "battle_reports"."dominion_loot_value" >= 0
          AND "battle_reports"."dominion_attacker_loss_value" >= 0
          AND "battle_reports"."dominion_defender_loss_value" >= 0
          AND "battle_reports"."dominion_raw_exchange" = "battle_reports"."dominion_loot_value"
            + "battle_reports"."dominion_defender_loss_value" - "battle_reports"."dominion_attacker_loss_value"
          AND "battle_reports"."dominion_swing" IS NOT NULL
          AND ("battle_reports"."dominion_rule_version" < 7
            OR "battle_reports"."clan_war_operation_id" IS NOT NULL
            OR "battle_reports"."defender_count" > 1
            OR "battle_reports"."dominion_raw_exchange" = "battle_reports"."dominion_swing"))) NOT VALID;--> statement-breakpoint
ALTER TABLE "battle_reports" VALIDATE CONSTRAINT "battle_reports_dominion_audit_check";--> statement-breakpoint
ALTER TABLE "planets" ADD CONSTRAINT "planets_defence_posture_check" CHECK ("planets"."defence_posture" IN ('ESCAPE', 'SUPPORT', 'HOLD'));--> statement-breakpoint
ALTER TABLE "probe_reports" ADD CONSTRAINT "probe_reports_posture_check" CHECK ("probe_reports"."posture" IS NULL OR "probe_reports"."posture" IN ('ESCAPE', 'SUPPORT', 'HOLD'));
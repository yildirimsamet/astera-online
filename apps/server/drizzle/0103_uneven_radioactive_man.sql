ALTER TYPE "public"."event_kind" ADD VALUE 'clan_war_expiry';--> statement-breakpoint
ALTER TYPE "public"."mission_kind" ADD VALUE 'clan_war';--> statement-breakpoint
CREATE TABLE "clan_treasury_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"clan_id" uuid NOT NULL,
	"actor_player_id" uuid,
	"source_planet_id" uuid,
	"kind" text NOT NULL,
	"alloy" bigint DEFAULT 0 NOT NULL,
	"crystal" bigint DEFAULT 0 NOT NULL,
	"deuterium" bigint DEFAULT 0 NOT NULL,
	"level_before" integer,
	"level_after" integer,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "clan_treasury_events_kind_check" CHECK ("clan_treasury_events"."kind" IN ('DONATION', 'LEVEL_UP', 'DISBAND_BURN')),
	CONSTRAINT "clan_treasury_events_shape_check" CHECK (CASE "clan_treasury_events"."kind"
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
          ELSE false
        END),
	CONSTRAINT "clan_treasury_events_range_check" CHECK ("clan_treasury_events"."alloy" BETWEEN -9007199254740991 AND 9007199254740991
      AND "clan_treasury_events"."crystal" BETWEEN -9007199254740991 AND 9007199254740991
      AND "clan_treasury_events"."deuterium" BETWEEN -9007199254740991 AND 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "clan_war_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"clan_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"origin_planet_id" uuid NOT NULL,
	"source_kind" text DEFAULT 'PHYSICAL' NOT NULL,
	"fleet" jsonb NOT NULL,
	"tech" jsonb NOT NULL,
	"unit_location" text NOT NULL,
	"reserved_bulk" real NOT NULL,
	"fuel_paid" real NOT NULL,
	"fuel_legs" jsonb NOT NULL,
	"status" text DEFAULT 'OUTBOUND' NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"staged_at" timestamp with time zone,
	"recalled_at" timestamp with time zone,
	"battle_at" timestamp with time zone,
	"return_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"losses" jsonb,
	"survivors" jsonb,
	"loot" jsonb,
	"salvage" jsonb,
	"hull_damage" real,
	CONSTRAINT "clan_war_contributions_status_check" CHECK ("clan_war_contributions"."status" IN ('OUTBOUND', 'STAGED', 'RECALL_ORDERED', 'IN_BATTLE',
      'RETURNING', 'HOME', 'LOST')),
	CONSTRAINT "clan_war_contributions_source_check" CHECK ("clan_war_contributions"."source_kind" IN ('PHYSICAL', 'LEADER_CAPITAL')),
	CONSTRAINT "clan_war_contributions_amounts_check" CHECK ("clan_war_contributions"."reserved_bulk" >= 0 AND "clan_war_contributions"."fuel_paid" >= 0)
);
--> statement-breakpoint
CREATE TABLE "clan_war_dominion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"report_id" uuid,
	"player_id" uuid NOT NULL,
	"role" text NOT NULL,
	"ruleset_version" integer NOT NULL,
	"attacker_count" integer NOT NULL,
	"defender_count" integer NOT NULL,
	"base_exchange" bigint NOT NULL,
	"adjusted_transfer" bigint NOT NULL,
	"delta" bigint NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "clan_war_dominion_events_role_check" CHECK ("clan_war_dominion_events"."role" IN ('ATTACKER', 'DEFENDER')),
	CONSTRAINT "clan_war_dominion_events_count_check" CHECK ("clan_war_dominion_events"."attacker_count" >= 1 AND "clan_war_dominion_events"."defender_count" >= 1 AND "clan_war_dominion_events"."ruleset_version" > 0),
	CONSTRAINT "clan_war_dominion_events_range_check" CHECK ("clan_war_dominion_events"."base_exchange" BETWEEN -9007199254740991 AND 9007199254740991
      AND "clan_war_dominion_events"."adjusted_transfer" BETWEEN -9007199254740991 AND 9007199254740991
      AND "clan_war_dominion_events"."delta" BETWEEN -9007199254740991 AND 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "clan_war_missions" (
	"mission_id" uuid PRIMARY KEY NOT NULL,
	"operation_id" uuid NOT NULL,
	"contribution_id" uuid,
	"leg" text NOT NULL,
	CONSTRAINT "clan_war_missions_leg_check" CHECK ("clan_war_missions"."leg" IN ('SUPPORT_OUT', 'SUPPORT_RETURN', 'COMBINED_ATTACK', 'BATTLE_RETURN')),
	CONSTRAINT "clan_war_missions_binding_check" CHECK (("clan_war_missions"."leg" = 'COMBINED_ATTACK') = ("clan_war_missions"."contribution_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "clan_war_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"clan_id" uuid NOT NULL,
	"clan_name" text NOT NULL,
	"clan_tag" text NOT NULL,
	"leader_player_id" uuid NOT NULL,
	"staging_planet_id" uuid NOT NULL,
	"target_planet_id" uuid NOT NULL,
	"target_player_id" uuid NOT NULL,
	"target_planet_name" text NOT NULL,
	"target_x" real NOT NULL,
	"target_y" real NOT NULL,
	"target_z" real NOT NULL,
	"status" text DEFAULT 'ASSEMBLING' NOT NULL,
	"close_reason" text,
	"attacker_score_clan_id" uuid,
	"defender_score_clan_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "clan_war_operations_status_check" CHECK ("clan_war_operations"."status" IN ('ASSEMBLING', 'ATTACKING', 'RETURNING', 'COMPLETED')),
	CONSTRAINT "clan_war_operations_close_reason_check" CHECK ("clan_war_operations"."close_reason" IS NULL
      OR "clan_war_operations"."close_reason" IN ('BATTLE', 'LEADER_CANCEL', 'EXPIRED', 'TARGET_CHANGED', 'FAILED')),
	CONSTRAINT "clan_war_operations_window_check" CHECK ("clan_war_operations"."expires_at" > "clan_war_operations"."created_at"),
	CONSTRAINT "clan_war_operations_lifecycle_check" CHECK (CASE "clan_war_operations"."status"
          WHEN 'ASSEMBLING' THEN "clan_war_operations"."started_at" IS NULL AND "clan_war_operations"."resolved_at" IS NULL
            AND "clan_war_operations"."completed_at" IS NULL AND "clan_war_operations"."close_reason" IS NULL
          WHEN 'ATTACKING' THEN "clan_war_operations"."started_at" IS NOT NULL AND "clan_war_operations"."resolved_at" IS NULL
            AND "clan_war_operations"."completed_at" IS NULL AND "clan_war_operations"."close_reason" IS NULL
          WHEN 'RETURNING' THEN "clan_war_operations"."close_reason" IS NOT NULL AND "clan_war_operations"."completed_at" IS NULL
          WHEN 'COMPLETED' THEN "clan_war_operations"."close_reason" IS NOT NULL AND "clan_war_operations"."completed_at" IS NOT NULL
          ELSE false
        END),
	CONSTRAINT "clan_war_operations_battle_check" CHECK (("clan_war_operations"."resolved_at" IS NULL OR "clan_war_operations"."close_reason" = 'BATTLE')
      AND ("clan_war_operations"."close_reason" IS DISTINCT FROM 'BATTLE'
        OR ("clan_war_operations"."started_at" IS NOT NULL AND "clan_war_operations"."resolved_at" IS NOT NULL))
      AND ("clan_war_operations"."close_reason" IS DISTINCT FROM 'FAILED' OR "clan_war_operations"."started_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "clan_war_participant_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"report_id" uuid,
	"player_id" uuid NOT NULL,
	"sent" jsonb NOT NULL,
	"losses" jsonb NOT NULL,
	"survivors" jsonb NOT NULL,
	"loot" jsonb NOT NULL,
	"salvage" jsonb NOT NULL,
	"hull_damage" real DEFAULT 0 NOT NULL,
	"dominion_raw" bigint DEFAULT 0 NOT NULL,
	"dominion_delta" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "clan_war_participant_results_range_check" CHECK ("clan_war_participant_results"."hull_damage" >= 0
      AND "clan_war_participant_results"."dominion_raw" BETWEEN -9007199254740991 AND 9007199254740991
      AND "clan_war_participant_results"."dominion_delta" BETWEEN -9007199254740991 AND 9007199254740991)
);
--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "clan_war_operation_id" uuid;--> statement-breakpoint
ALTER TABLE "clans" ADD COLUMN "level" integer;--> statement-breakpoint
ALTER TABLE "clans" ADD COLUMN "treasury_alloy" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clans" ADD COLUMN "treasury_crystal" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clans" ADD COLUMN "treasury_deuterium" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clan_treasury_events" ADD CONSTRAINT "clan_treasury_events_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_treasury_events" ADD CONSTRAINT "clan_treasury_events_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_treasury_events" ADD CONSTRAINT "clan_treasury_events_actor_player_id_players_id_fk" FOREIGN KEY ("actor_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_treasury_events" ADD CONSTRAINT "clan_treasury_events_source_planet_id_planets_id_fk" FOREIGN KEY ("source_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_contributions" ADD CONSTRAINT "clan_war_contributions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_contributions" ADD CONSTRAINT "clan_war_contributions_operation_id_clan_war_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."clan_war_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_contributions" ADD CONSTRAINT "clan_war_contributions_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_contributions" ADD CONSTRAINT "clan_war_contributions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_contributions" ADD CONSTRAINT "clan_war_contributions_origin_planet_id_planets_id_fk" FOREIGN KEY ("origin_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_dominion_events" ADD CONSTRAINT "clan_war_dominion_events_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_missions" ADD CONSTRAINT "clan_war_missions_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_missions" ADD CONSTRAINT "clan_war_missions_operation_id_clan_war_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."clan_war_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_missions" ADD CONSTRAINT "clan_war_missions_contribution_id_clan_war_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."clan_war_contributions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_operations" ADD CONSTRAINT "clan_war_operations_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_operations" ADD CONSTRAINT "clan_war_operations_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_operations" ADD CONSTRAINT "clan_war_operations_leader_player_id_players_id_fk" FOREIGN KEY ("leader_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_operations" ADD CONSTRAINT "clan_war_operations_staging_planet_id_planets_id_fk" FOREIGN KEY ("staging_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_operations" ADD CONSTRAINT "clan_war_operations_target_planet_id_planets_id_fk" FOREIGN KEY ("target_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_operations" ADD CONSTRAINT "clan_war_operations_target_player_id_players_id_fk" FOREIGN KEY ("target_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_operations" ADD CONSTRAINT "clan_war_operations_attacker_score_clan_id_clans_id_fk" FOREIGN KEY ("attacker_score_clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_operations" ADD CONSTRAINT "clan_war_operations_defender_score_clan_id_clans_id_fk" FOREIGN KEY ("defender_score_clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_participant_results" ADD CONSTRAINT "clan_war_participant_results_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_participant_results" ADD CONSTRAINT "clan_war_participant_results_operation_id_clan_war_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."clan_war_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_war_participant_results" ADD CONSTRAINT "clan_war_participant_results_report_id_battle_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."battle_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clan_treasury_events_clan_idx" ON "clan_treasury_events" USING btree ("clan_id","created_at");--> statement-breakpoint
CREATE INDEX "clan_treasury_events_actor_idx" ON "clan_treasury_events" USING btree ("actor_player_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_war_contributions_unit_location_idx" ON "clan_war_contributions" USING btree ("unit_location");--> statement-breakpoint
CREATE INDEX "clan_war_contributions_operation_idx" ON "clan_war_contributions" USING btree ("operation_id","status");--> statement-breakpoint
CREATE INDEX "clan_war_contributions_player_idx" ON "clan_war_contributions" USING btree ("player_id","status");--> statement-breakpoint
CREATE INDEX "clan_war_contributions_origin_idx" ON "clan_war_contributions" USING btree ("origin_planet_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_war_dominion_events_idx" ON "clan_war_dominion_events" USING btree ("operation_id","player_id","role");--> statement-breakpoint
CREATE INDEX "clan_war_dominion_events_season_idx" ON "clan_war_dominion_events" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "clan_war_dominion_events_player_idx" ON "clan_war_dominion_events" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_war_missions_aggregate_idx" ON "clan_war_missions" USING btree ("operation_id","leg") WHERE "clan_war_missions"."contribution_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "clan_war_missions_contribution_leg_idx" ON "clan_war_missions" USING btree ("contribution_id","leg") WHERE "clan_war_missions"."contribution_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "clan_war_missions_operation_idx" ON "clan_war_missions" USING btree ("operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_war_operations_open_idx" ON "clan_war_operations" USING btree ("clan_id") WHERE "clan_war_operations"."status" <> 'COMPLETED';--> statement-breakpoint
CREATE INDEX "clan_war_operations_expiry_idx" ON "clan_war_operations" USING btree ("season_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "clan_war_operations_target_idx" ON "clan_war_operations" USING btree ("target_planet_id","status");--> statement-breakpoint
CREATE INDEX "clan_war_operations_target_player_idx" ON "clan_war_operations" USING btree ("target_player_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_war_participant_results_idx" ON "clan_war_participant_results" USING btree ("operation_id","player_id");--> statement-breakpoint
CREATE INDEX "clan_war_participant_results_player_idx" ON "clan_war_participant_results" USING btree ("player_id","created_at");--> statement-breakpoint
CREATE INDEX "clan_war_participant_results_report_idx" ON "clan_war_participant_results" USING btree ("report_id");--> statement-breakpoint
ALTER TABLE "battle_reports" ADD CONSTRAINT "battle_reports_clan_war_operation_id_clan_war_operations_id_fk" FOREIGN KEY ("clan_war_operation_id") REFERENCES "public"."clan_war_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "battle_reports_clan_war_operation_idx" ON "battle_reports" USING btree ("clan_war_operation_id") WHERE "battle_reports"."clan_war_operation_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "clans" ADD CONSTRAINT "clans_level_check" CHECK ("clans"."level" IS NULL OR "clans"."level" BETWEEN 1 AND 10);--> statement-breakpoint
ALTER TABLE "clans" ADD CONSTRAINT "clans_treasury_range_check" CHECK ("clans"."treasury_alloy" BETWEEN 0 AND 9007199254740991
      AND "clans"."treasury_crystal" BETWEEN 0 AND 9007199254740991
      AND "clans"."treasury_deuterium" BETWEEN 0 AND 9007199254740991);
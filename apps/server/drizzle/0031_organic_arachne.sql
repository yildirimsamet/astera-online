ALTER TYPE "public"."mission_kind" ADD VALUE 'clan_transfer';--> statement-breakpoint
CREATE TABLE "attack_commitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"mission_id" uuid NOT NULL,
	"attacker_player_id" uuid NOT NULL,
	"target_player_id" uuid NOT NULL,
	"quota_clan_id" uuid,
	"attacker_score_clan_id" uuid,
	"defender_score_clan_id" uuid,
	"launched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "attack_commitments_window_check" CHECK ("attack_commitments"."expires_at" > "attack_commitments"."launched_at")
);
--> statement-breakpoint
CREATE TABLE "clan_aid_commitments" (
	"mission_id" uuid PRIMARY KEY NOT NULL,
	"season_id" uuid NOT NULL,
	"clan_id" uuid NOT NULL,
	"sender_player_id" uuid NOT NULL,
	"recipient_player_id" uuid NOT NULL,
	"sender_home_planet_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"return_travel_seconds" real NOT NULL,
	"status" text DEFAULT 'OUTBOUND' NOT NULL,
	"committed_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "clan_aid_status_check" CHECK ("clan_aid_commitments"."status" IN ('OUTBOUND', 'RETURNING', 'DELIVERED', 'RETURNED')),
	CONSTRAINT "clan_aid_window_check" CHECK ("clan_aid_commitments"."expires_at" > "clan_aid_commitments"."committed_at"),
	CONSTRAINT "clan_aid_return_time_check" CHECK ("clan_aid_commitments"."return_travel_seconds" > 0)
);
--> statement-breakpoint
CREATE TABLE "clan_ceasefires" (
	"season_id" uuid NOT NULL,
	"player_low_id" uuid NOT NULL,
	"player_high_id" uuid NOT NULL,
	"source_clan_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	CONSTRAINT "clan_ceasefires_season_id_player_low_id_player_high_id_pk" PRIMARY KEY("season_id","player_low_id","player_high_id"),
	CONSTRAINT "clan_ceasefires_pair_check" CHECK ("clan_ceasefires"."player_low_id" < "clan_ceasefires"."player_high_id"),
	CONSTRAINT "clan_ceasefires_window_check" CHECK ("clan_ceasefires"."ends_at" > "clan_ceasefires"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "clan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"clan_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"actor_player_id" uuid,
	"actor_name" text,
	"subject_player_id" uuid,
	"subject_name" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clan_loot_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"source_mission_id" uuid NOT NULL,
	"clan_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"alloy" real DEFAULT 0 NOT NULL,
	"crystal" real DEFAULT 0 NOT NULL,
	"deuterium" real DEFAULT 0 NOT NULL,
	"remaining_alloy" real DEFAULT 0 NOT NULL,
	"remaining_crystal" real DEFAULT 0 NOT NULL,
	"remaining_deuterium" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_claimed_at" timestamp with time zone,
	CONSTRAINT "clan_loot_shares_remaining_check" CHECK ("clan_loot_shares"."remaining_alloy" BETWEEN 0 AND "clan_loot_shares"."alloy"
      AND "clan_loot_shares"."remaining_crystal" BETWEEN 0 AND "clan_loot_shares"."crystal"
      AND "clan_loot_shares"."remaining_deuterium" BETWEEN 0 AND "clan_loot_shares"."deuterium")
);
--> statement-breakpoint
CREATE TABLE "clan_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"clan_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"role" text DEFAULT 'MEMBER' NOT NULL,
	"slot" integer NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"mature_at" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone,
	"aid_enabled" boolean DEFAULT true NOT NULL,
	"aid_policy_changed_at" timestamp with time zone NOT NULL,
	"last_chat_read_at" timestamp with time zone,
	CONSTRAINT "clan_memberships_role_check" CHECK ("clan_memberships"."role" IN ('LEADER', 'MEMBER')),
	CONSTRAINT "clan_memberships_slot_check" CHECK ("clan_memberships"."slot" BETWEEN 0 AND 4),
	CONSTRAINT "clan_memberships_maturity_check" CHECK ("clan_memberships"."mature_at" >= "clan_memberships"."joined_at"),
	CONSTRAINT "clan_memberships_left_check" CHECK ("clan_memberships"."left_at" IS NULL OR "clan_memberships"."left_at" >= "clan_memberships"."joined_at")
);
--> statement-breakpoint
CREATE TABLE "clan_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"clan_id" uuid NOT NULL,
	"author_player_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "clan_messages_content_check" CHECK (char_length(btrim("clan_messages"."content")) BETWEEN 1 AND 280)
);
--> statement-breakpoint
CREATE TABLE "clan_raid_roster" (
	"mission_id" uuid NOT NULL,
	"clan_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	CONSTRAINT "clan_raid_roster_mission_id_player_id_pk" PRIMARY KEY("mission_id","player_id"),
	CONSTRAINT "clan_raid_roster_slot_check" CHECK ("clan_raid_roster"."slot" BETWEEN 0 AND 4)
);
--> statement-breakpoint
CREATE TABLE "clan_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"clan_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_by_player_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "clan_requests_kind_check" CHECK ("clan_requests"."kind" IN ('APPLICATION', 'INVITATION')),
	CONSTRAINT "clan_requests_status_check" CHECK ("clan_requests"."status" IN ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'CLOSED')),
	CONSTRAINT "clan_requests_expiry_check" CHECK ("clan_requests"."expires_at" > "clan_requests"."created_at")
);
--> statement-breakpoint
CREATE TABLE "clan_score_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"mission_id" uuid NOT NULL,
	"clan_id" uuid NOT NULL,
	"side" text NOT NULL,
	"dominion_delta" real NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "clan_score_events_side_check" CHECK ("clan_score_events"."side" IN ('ATTACK', 'DEFENCE'))
);
--> statement-breakpoint
CREATE TABLE "clans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"tag" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"recruiting" boolean DEFAULT true NOT NULL,
	"dominion_taken" real DEFAULT 0 NOT NULL,
	"dominion_lost" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"disbanded_at" timestamp with time zone,
	CONSTRAINT "clans_name_length_check" CHECK (char_length("clans"."name") BETWEEN 3 AND 24),
	CONSTRAINT "clans_tag_check" CHECK ("clans"."tag" ~ '^[A-Z0-9]{2,5}$'),
	CONSTRAINT "clans_description_length_check" CHECK (char_length("clans"."description") <= 160)
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "last_clan_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "clan_locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "request_log" ADD COLUMN "id" uuid DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "request_log" ADD COLUMN "operation" text;--> statement-breakpoint
ALTER TABLE "request_log" ADD COLUMN "request_hash" text;--> statement-breakpoint
UPDATE "request_log"
SET "operation" = 'legacy', "request_hash" = 'legacy:' || "idempotency_key";--> statement-breakpoint
ALTER TABLE "request_log" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "request_log" ALTER COLUMN "operation" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "request_log" ALTER COLUMN "request_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "request_log" DROP CONSTRAINT "request_log_pkey";--> statement-breakpoint
ALTER TABLE "request_log" ADD CONSTRAINT "request_log_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "attack_commitments" ADD CONSTRAINT "attack_commitments_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attack_commitments" ADD CONSTRAINT "attack_commitments_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attack_commitments" ADD CONSTRAINT "attack_commitments_attacker_player_id_players_id_fk" FOREIGN KEY ("attacker_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attack_commitments" ADD CONSTRAINT "attack_commitments_target_player_id_players_id_fk" FOREIGN KEY ("target_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attack_commitments" ADD CONSTRAINT "attack_commitments_quota_clan_id_clans_id_fk" FOREIGN KEY ("quota_clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attack_commitments" ADD CONSTRAINT "attack_commitments_attacker_score_clan_id_clans_id_fk" FOREIGN KEY ("attacker_score_clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attack_commitments" ADD CONSTRAINT "attack_commitments_defender_score_clan_id_clans_id_fk" FOREIGN KEY ("defender_score_clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_aid_commitments" ADD CONSTRAINT "clan_aid_commitments_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_aid_commitments" ADD CONSTRAINT "clan_aid_commitments_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_aid_commitments" ADD CONSTRAINT "clan_aid_commitments_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_aid_commitments" ADD CONSTRAINT "clan_aid_commitments_sender_player_id_players_id_fk" FOREIGN KEY ("sender_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_aid_commitments" ADD CONSTRAINT "clan_aid_commitments_recipient_player_id_players_id_fk" FOREIGN KEY ("recipient_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_aid_commitments" ADD CONSTRAINT "clan_aid_commitments_sender_home_planet_id_planets_id_fk" FOREIGN KEY ("sender_home_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_ceasefires" ADD CONSTRAINT "clan_ceasefires_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_ceasefires" ADD CONSTRAINT "clan_ceasefires_player_low_id_players_id_fk" FOREIGN KEY ("player_low_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_ceasefires" ADD CONSTRAINT "clan_ceasefires_player_high_id_players_id_fk" FOREIGN KEY ("player_high_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_ceasefires" ADD CONSTRAINT "clan_ceasefires_source_clan_id_clans_id_fk" FOREIGN KEY ("source_clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_events" ADD CONSTRAINT "clan_events_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_events" ADD CONSTRAINT "clan_events_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_loot_shares" ADD CONSTRAINT "clan_loot_shares_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_loot_shares" ADD CONSTRAINT "clan_loot_shares_source_mission_id_missions_id_fk" FOREIGN KEY ("source_mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_loot_shares" ADD CONSTRAINT "clan_loot_shares_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_loot_shares" ADD CONSTRAINT "clan_loot_shares_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_memberships" ADD CONSTRAINT "clan_memberships_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_memberships" ADD CONSTRAINT "clan_memberships_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_memberships" ADD CONSTRAINT "clan_memberships_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_messages" ADD CONSTRAINT "clan_messages_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_messages" ADD CONSTRAINT "clan_messages_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_messages" ADD CONSTRAINT "clan_messages_author_player_id_players_id_fk" FOREIGN KEY ("author_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_raid_roster" ADD CONSTRAINT "clan_raid_roster_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_raid_roster" ADD CONSTRAINT "clan_raid_roster_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_requests" ADD CONSTRAINT "clan_requests_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_requests" ADD CONSTRAINT "clan_requests_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_requests" ADD CONSTRAINT "clan_requests_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_requests" ADD CONSTRAINT "clan_requests_created_by_player_id_players_id_fk" FOREIGN KEY ("created_by_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_score_events" ADD CONSTRAINT "clan_score_events_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_score_events" ADD CONSTRAINT "clan_score_events_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_score_events" ADD CONSTRAINT "clan_score_events_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clans" ADD CONSTRAINT "clans_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attack_commitments_mission_idx" ON "attack_commitments" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "attack_commitments_personal_idx" ON "attack_commitments" USING btree ("attacker_player_id","target_player_id","expires_at");--> statement-breakpoint
CREATE INDEX "attack_commitments_clan_idx" ON "attack_commitments" USING btree ("quota_clan_id","target_player_id","expires_at");--> statement-breakpoint
CREATE INDEX "clan_aid_recipient_window_idx" ON "clan_aid_commitments" USING btree ("recipient_player_id","expires_at");--> statement-breakpoint
CREATE INDEX "clan_aid_sender_idx" ON "clan_aid_commitments" USING btree ("sender_player_id","committed_at");--> statement-breakpoint
CREATE INDEX "clan_ceasefires_expiry_idx" ON "clan_ceasefires" USING btree ("season_id","ends_at");--> statement-breakpoint
CREATE INDEX "clan_events_cursor_idx" ON "clan_events" USING btree ("clan_id","occurred_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_loot_shares_source_player_idx" ON "clan_loot_shares" USING btree ("source_mission_id","player_id");--> statement-breakpoint
CREATE INDEX "clan_loot_shares_player_idx" ON "clan_loot_shares" USING btree ("player_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_memberships_active_player_idx" ON "clan_memberships" USING btree ("player_id") WHERE "clan_memberships"."left_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "clan_memberships_active_slot_idx" ON "clan_memberships" USING btree ("clan_id","slot") WHERE "clan_memberships"."left_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "clan_memberships_active_leader_idx" ON "clan_memberships" USING btree ("clan_id") WHERE "clan_memberships"."left_at" IS NULL AND "clan_memberships"."role" = 'LEADER';--> statement-breakpoint
CREATE INDEX "clan_memberships_clan_history_idx" ON "clan_memberships" USING btree ("clan_id","joined_at");--> statement-breakpoint
CREATE INDEX "clan_memberships_player_history_idx" ON "clan_memberships" USING btree ("player_id","joined_at");--> statement-breakpoint
CREATE INDEX "clan_messages_cursor_idx" ON "clan_messages" USING btree ("clan_id","created_at","id");--> statement-breakpoint
CREATE INDEX "clan_messages_author_rate_idx" ON "clan_messages" USING btree ("author_player_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_raid_roster_slot_idx" ON "clan_raid_roster" USING btree ("mission_id","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_requests_pending_pair_idx" ON "clan_requests" USING btree ("clan_id","player_id") WHERE "clan_requests"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "clan_requests_clan_status_idx" ON "clan_requests" USING btree ("clan_id","status","created_at");--> statement-breakpoint
CREATE INDEX "clan_requests_player_status_idx" ON "clan_requests" USING btree ("player_id","status","created_at");--> statement-breakpoint
CREATE INDEX "clan_requests_inviter_rate_idx" ON "clan_requests" USING btree ("created_by_player_id","kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_score_events_source_idx" ON "clan_score_events" USING btree ("mission_id","clan_id","side");--> statement-breakpoint
CREATE INDEX "clan_score_events_clan_idx" ON "clan_score_events" USING btree ("clan_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clans_season_name_idx" ON "clans" USING btree ("season_id","name_key");--> statement-breakpoint
CREATE UNIQUE INDEX "clans_season_tag_idx" ON "clans" USING btree ("season_id","tag");--> statement-breakpoint
CREATE INDEX "clans_season_score_idx" ON "clans" USING btree ("season_id","dominion_taken","dominion_lost");--> statement-breakpoint
CREATE UNIQUE INDEX "request_log_scope_idx" ON "request_log" USING btree ("player_id","operation","idempotency_key");--> statement-breakpoint
CREATE INDEX "request_log_created_idx" ON "request_log" USING btree ("created_at");

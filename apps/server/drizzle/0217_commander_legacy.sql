CREATE TABLE "legacy_activity_days" (
	"account_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"day" integer NOT NULL,
	"first_action_at" timestamp with time zone NOT NULL,
	CONSTRAINT "legacy_activity_days_account_id_season_id_day_pk" PRIMARY KEY("account_id","season_id","day"),
	CONSTRAINT "legacy_activity_day_check" CHECK ("legacy_activity_days"."day" >= 0)
);
--> statement-breakpoint
CREATE TABLE "legacy_attack_intents" (
	"account_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"opponent_account_id" uuid NOT NULL,
	"attacker_tier" integer NOT NULL,
	"defender_tier" integer NOT NULL,
	"committed_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "legacy_attack_intents_account_id_season_id_source_key_opponent_account_id_pk" PRIMARY KEY("account_id","season_id","source_key","opponent_account_id"),
	CONSTRAINT "legacy_attack_intents_tiers_check" CHECK ("legacy_attack_intents"."attacker_tier" > 0 AND "legacy_attack_intents"."defender_tier" > "legacy_attack_intents"."attacker_tier"),
	CONSTRAINT "legacy_attack_intents_time_check" CHECK ("legacy_attack_intents"."settled_at" IS NULL OR "legacy_attack_intents"."settled_at" >= "legacy_attack_intents"."committed_at")
);
--> statement-breakpoint
CREATE TABLE "legacy_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"definition_id" text NOT NULL,
	"tier" integer NOT NULL,
	"edition" text NOT NULL,
	"source_season_id" uuid,
	"rarity" text NOT NULL,
	"rule_version" integer NOT NULL,
	"earned_at" timestamp with time zone,
	"granted_at" timestamp with time zone NOT NULL,
	"evidence" jsonb NOT NULL,
	"revoked_at" timestamp with time zone,
	"revocation_reason" text,
	"revealed_at" timestamp with time zone,
	CONSTRAINT "legacy_awards_tier_check" CHECK ("legacy_awards"."tier" > 0 AND "legacy_awards"."rule_version" > 0),
	CONSTRAINT "legacy_awards_rarity_check" CHECK ("legacy_awards"."rarity" IN ('COMMON', 'RARE', 'EPIC', 'LEGENDARY')),
	CONSTRAINT "legacy_awards_reversal_check" CHECK (("legacy_awards"."revoked_at" IS NULL) = ("legacy_awards"."revocation_reason" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_awards_owner_id_idx" ON "legacy_awards" USING btree ("account_id","id");--> statement-breakpoint
CREATE TABLE "legacy_facts" (
	"account_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"source_key" text NOT NULL,
	"origin" text DEFAULT 'EVENT' NOT NULL,
	"amount" bigint NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"date_known" boolean DEFAULT true NOT NULL,
	CONSTRAINT "legacy_facts_account_id_season_id_metric_source_key_pk" PRIMARY KEY("account_id","season_id","metric","source_key"),
	CONSTRAINT "legacy_facts_amount_check" CHECK ("legacy_facts"."amount" BETWEEN 1 AND 9007199254740991),
	CONSTRAINT "legacy_facts_origin_check" CHECK ("legacy_facts"."origin" IN ('EVENT', 'RESTORED', 'ARCHIVE'))
);
--> statement-breakpoint
CREATE TABLE "legacy_monument_intervals" (
	"account_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"from_at" timestamp with time zone NOT NULL,
	"to_at" timestamp with time zone NOT NULL,
	CONSTRAINT "legacy_monument_intervals_account_id_season_id_source_key_pk" PRIMARY KEY("account_id","season_id","source_key"),
	CONSTRAINT "legacy_monument_interval_check" CHECK ("legacy_monument_intervals"."to_at" > "legacy_monument_intervals"."from_at")
);
--> statement-breakpoint
CREATE TABLE "legacy_participation" (
	"account_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	CONSTRAINT "legacy_participation_account_id_season_id_pk" PRIMARY KEY("account_id","season_id")
);
--> statement-breakpoint
CREATE TABLE "legacy_profiles" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"active_title_award_id" uuid,
	"portrait" text DEFAULT 'commander' NOT NULL,
	"backdrop" text DEFAULT 'nebula' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legacy_showcase_slots" (
	"account_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"award_id" uuid NOT NULL,
	CONSTRAINT "legacy_showcase_slots_account_id_slot_pk" PRIMARY KEY("account_id","slot"),
	CONSTRAINT "legacy_showcase_slot_check" CHECK ("legacy_showcase_slots"."slot" BETWEEN 0 AND 5)
);
--> statement-breakpoint
ALTER TABLE "legacy_activity_days" ADD CONSTRAINT "legacy_activity_days_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_activity_days" ADD CONSTRAINT "legacy_activity_days_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_attack_intents" ADD CONSTRAINT "legacy_attack_intents_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_attack_intents" ADD CONSTRAINT "legacy_attack_intents_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_attack_intents" ADD CONSTRAINT "legacy_attack_intents_opponent_account_id_accounts_id_fk" FOREIGN KEY ("opponent_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_awards" ADD CONSTRAINT "legacy_awards_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_awards" ADD CONSTRAINT "legacy_awards_source_season_id_seasons_id_fk" FOREIGN KEY ("source_season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_facts" ADD CONSTRAINT "legacy_facts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_facts" ADD CONSTRAINT "legacy_facts_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_monument_intervals" ADD CONSTRAINT "legacy_monument_intervals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_monument_intervals" ADD CONSTRAINT "legacy_monument_intervals_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_participation" ADD CONSTRAINT "legacy_participation_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_participation" ADD CONSTRAINT "legacy_participation_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_profiles" ADD CONSTRAINT "legacy_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_profiles" ADD CONSTRAINT "legacy_profiles_account_id_active_title_award_id_legacy_awards_account_id_id_fk" FOREIGN KEY ("account_id","active_title_award_id") REFERENCES "public"."legacy_awards"("account_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_showcase_slots" ADD CONSTRAINT "legacy_showcase_slots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_showcase_slots" ADD CONSTRAINT "legacy_showcase_slots_account_id_award_id_legacy_awards_account_id_id_fk" FOREIGN KEY ("account_id","award_id") REFERENCES "public"."legacy_awards"("account_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "legacy_attack_intents_source_idx" ON "legacy_attack_intents" USING btree ("season_id","source_key");--> statement-breakpoint
CREATE INDEX "legacy_awards_reveal_idx" ON "legacy_awards" USING btree ("account_id") WHERE "legacy_awards"."revealed_at" IS NULL AND "legacy_awards"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_awards_edition_idx" ON "legacy_awards" USING btree ("account_id","definition_id","tier","edition");--> statement-breakpoint
CREATE INDEX "legacy_awards_collection_idx" ON "legacy_awards" USING btree ("account_id","granted_at","id");--> statement-breakpoint
CREATE INDEX "legacy_awards_owners_idx" ON "legacy_awards" USING btree ("definition_id","tier","edition") WHERE "legacy_awards"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "legacy_facts_season_idx" ON "legacy_facts" USING btree ("season_id","account_id");--> statement-breakpoint
CREATE INDEX "legacy_facts_metric_idx" ON "legacy_facts" USING btree ("account_id","metric");--> statement-breakpoint
CREATE INDEX "legacy_monument_intervals_season_idx" ON "legacy_monument_intervals" USING btree ("season_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_profiles_public_idx" ON "legacy_profiles" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_showcase_award_idx" ON "legacy_showcase_slots" USING btree ("account_id","award_id");
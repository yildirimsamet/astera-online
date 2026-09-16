CREATE TABLE "season_reward_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_cycle_id" uuid NOT NULL,
	"source_season_id" uuid NOT NULL,
	"target_cycle_id" uuid,
	"account_id" uuid NOT NULL,
	"display_rank" integer NOT NULL,
	"reward_place" integer NOT NULL,
	"alloy" integer NOT NULL,
	"crystal" integer NOT NULL,
	"deuterium" integer NOT NULL,
	"program_version" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"delivered_season_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	CONSTRAINT "season_reward_entitlements_rank_check" CHECK ("season_reward_entitlements"."display_rank" > 0),
	CONSTRAINT "season_reward_entitlements_place_check" CHECK ("season_reward_entitlements"."reward_place" BETWEEN 1 AND 10),
	CONSTRAINT "season_reward_entitlements_amount_check" CHECK ("season_reward_entitlements"."alloy" >= 0 AND "season_reward_entitlements"."crystal" >= 0 AND "season_reward_entitlements"."deuterium" >= 0),
	CONSTRAINT "season_reward_entitlements_program_check" CHECK ("season_reward_entitlements"."program_version" > 0),
	CONSTRAINT "season_reward_entitlements_state_check" CHECK ((
      "season_reward_entitlements"."status" = 'PENDING'
      AND "season_reward_entitlements"."delivered_season_id" IS NULL
      AND "season_reward_entitlements"."delivered_at" IS NULL
      AND "season_reward_entitlements"."expired_at" IS NULL
    ) OR (
      "season_reward_entitlements"."status" = 'DELIVERED'
      AND "season_reward_entitlements"."target_cycle_id" IS NOT NULL
      AND "season_reward_entitlements"."delivered_season_id" IS NOT NULL
      AND "season_reward_entitlements"."delivered_at" IS NOT NULL
      AND "season_reward_entitlements"."expired_at" IS NULL
    ) OR (
      "season_reward_entitlements"."status" = 'EXPIRED'
      AND "season_reward_entitlements"."target_cycle_id" IS NOT NULL
      AND "season_reward_entitlements"."delivered_season_id" IS NULL
      AND "season_reward_entitlements"."delivered_at" IS NULL
      AND "season_reward_entitlements"."expired_at" IS NOT NULL
    ))
);
--> statement-breakpoint
ALTER TABLE "season_cycles" ADD COLUMN "reward_program_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "season_reward_entitlements" ADD CONSTRAINT "season_reward_entitlements_source_cycle_id_season_cycles_id_fk" FOREIGN KEY ("source_cycle_id") REFERENCES "public"."season_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_reward_entitlements" ADD CONSTRAINT "season_reward_entitlements_source_season_id_seasons_id_fk" FOREIGN KEY ("source_season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_reward_entitlements" ADD CONSTRAINT "season_reward_entitlements_target_cycle_id_season_cycles_id_fk" FOREIGN KEY ("target_cycle_id") REFERENCES "public"."season_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_reward_entitlements" ADD CONSTRAINT "season_reward_entitlements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_reward_entitlements" ADD CONSTRAINT "season_reward_entitlements_delivered_season_id_seasons_id_fk" FOREIGN KEY ("delivered_season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "season_reward_entitlements_source_account_idx" ON "season_reward_entitlements" USING btree ("source_season_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "season_reward_entitlements_source_place_idx" ON "season_reward_entitlements" USING btree ("source_season_id","reward_place");--> statement-breakpoint
CREATE INDEX "season_reward_entitlements_account_status_idx" ON "season_reward_entitlements" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX "season_reward_entitlements_target_status_idx" ON "season_reward_entitlements" USING btree ("target_cycle_id","status");
ALTER TABLE "mining_runs" ADD COLUMN "ordered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mining_runs" ADD COLUMN "command_source" text DEFAULT 'legacy_unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "mining_runs" ADD COLUMN "actor_account_id" uuid;--> statement-breakpoint
ALTER TABLE "mining_runs" ADD COLUMN "actor_player_id" uuid;--> statement-breakpoint
ALTER TABLE "mining_runs" ADD COLUMN "actor_season_id" uuid;--> statement-breakpoint
ALTER TABLE "mining_runs" ADD COLUMN "analytics_visit_hash" text;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "ordered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "command_source" text DEFAULT 'legacy_unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "actor_account_id" uuid;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "actor_player_id" uuid;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "actor_season_id" uuid;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "analytics_visit_hash" text;--> statement-breakpoint
ALTER TABLE "monument_waves" ADD COLUMN "ordered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "monument_waves" ADD COLUMN "command_source" text DEFAULT 'legacy_unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "monument_waves" ADD COLUMN "actor_account_id" uuid;--> statement-breakpoint
ALTER TABLE "monument_waves" ADD COLUMN "actor_player_id" uuid;--> statement-breakpoint
ALTER TABLE "monument_waves" ADD COLUMN "actor_season_id" uuid;--> statement-breakpoint
ALTER TABLE "monument_waves" ADD COLUMN "analytics_visit_hash" text;--> statement-breakpoint
ALTER TABLE "pirate_raids" ADD COLUMN "ordered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pirate_raids" ADD COLUMN "command_source" text DEFAULT 'legacy_unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "pirate_raids" ADD COLUMN "actor_account_id" uuid;--> statement-breakpoint
ALTER TABLE "pirate_raids" ADD COLUMN "actor_player_id" uuid;--> statement-breakpoint
ALTER TABLE "pirate_raids" ADD COLUMN "actor_season_id" uuid;--> statement-breakpoint
ALTER TABLE "pirate_raids" ADD COLUMN "analytics_visit_hash" text;--> statement-breakpoint
ALTER TABLE "trade_runs" ADD COLUMN "ordered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trade_runs" ADD COLUMN "command_source" text DEFAULT 'legacy_unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "trade_runs" ADD COLUMN "actor_account_id" uuid;--> statement-breakpoint
ALTER TABLE "trade_runs" ADD COLUMN "actor_player_id" uuid;--> statement-breakpoint
ALTER TABLE "trade_runs" ADD COLUMN "actor_season_id" uuid;--> statement-breakpoint
ALTER TABLE "trade_runs" ADD COLUMN "analytics_visit_hash" text;--> statement-breakpoint
ALTER TABLE "mining_runs" ADD CONSTRAINT "mining_runs_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monument_waves" ADD CONSTRAINT "monument_waves_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pirate_raids" ADD CONSTRAINT "pirate_raids_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_runs" ADD CONSTRAINT "trade_runs_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
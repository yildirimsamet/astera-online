CREATE TABLE "commander_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"source_season_id" uuid NOT NULL,
	"target_season_id" uuid NOT NULL,
	"from_version" integer NOT NULL,
	"to_version" integer NOT NULL,
	"direction" text NOT NULL,
	"application_id" uuid,
	"worlds" jsonb NOT NULL,
	"committed_at" timestamp with time zone NOT NULL,
	"emitted_at" timestamp with time zone,
	CONSTRAINT "commander_transfers_version_check" CHECK ("commander_transfers"."to_version" = "commander_transfers"."from_version" + 1)
);
--> statement-breakpoint
CREATE TABLE "main_vacancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"departure_transfer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"slot_index" integer NOT NULL,
	"x" real NOT NULL,
	"y" real NOT NULL,
	"z" real NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_reason" text
);
--> statement-breakpoint
CREATE TABLE "silent_space_maintenance" (
	"id" integer PRIMARY KEY NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"cursor_player_id" uuid,
	"last_run_at" timestamp with time zone,
	"last_result" jsonb
);
--> statement-breakpoint
ALTER TABLE "probe_world_memories" ADD COLUMN "invalidated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN "detached_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "commander_transfers" ADD CONSTRAINT "commander_transfers_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commander_transfers" ADD CONSTRAINT "commander_transfers_cycle_id_season_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."season_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commander_transfers" ADD CONSTRAINT "commander_transfers_source_season_id_seasons_id_fk" FOREIGN KEY ("source_season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commander_transfers" ADD CONSTRAINT "commander_transfers_target_season_id_seasons_id_fk" FOREIGN KEY ("target_season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main_vacancies" ADD CONSTRAINT "main_vacancies_cycle_id_season_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."season_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main_vacancies" ADD CONSTRAINT "main_vacancies_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main_vacancies" ADD CONSTRAINT "main_vacancies_departure_transfer_id_commander_transfers_id_fk" FOREIGN KEY ("departure_transfer_id") REFERENCES "public"."commander_transfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commander_transfers_version_idx" ON "commander_transfers" USING btree ("player_id","from_version");--> statement-breakpoint
CREATE INDEX "commander_transfers_outbox_idx" ON "commander_transfers" USING btree ("emitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "main_vacancies_open_idx" ON "main_vacancies" USING btree ("season_id","slot_index") WHERE "main_vacancies"."consumed_at" IS NULL;
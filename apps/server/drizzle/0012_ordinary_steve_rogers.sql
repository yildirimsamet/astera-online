CREATE TABLE "season_results" (
	"season_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"final_rank" integer NOT NULL,
	"dominion" real NOT NULL,
	"damage_dealt" real DEFAULT 0 NOT NULL,
	"damage_taken" real DEFAULT 0 NOT NULL,
	"rival_name" text,
	"biggest_raid" real DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"recap" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "season_results_season_id_account_id_pk" PRIMARY KEY("season_id","account_id")
);
--> statement-breakpoint
ALTER TABLE "season_results" ADD CONSTRAINT "season_results_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_results" ADD CONSTRAINT "season_results_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "season_results_account_idx" ON "season_results" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "events_one_season_end_idx" ON "scheduled_events" USING btree ("season_id","kind") WHERE "scheduled_events"."kind" = 'season_end';
CREATE SEQUENCE "public"."personal_pirate_index_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "newcomer_scenario" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"season_id" uuid NOT NULL,
	"step" text NOT NULL,
	"pirate_index" integer DEFAULT -nextval('personal_pirate_index_seq') NOT NULL,
	"pirate_spec" jsonb,
	"pirate_spawned_at" timestamp with time zone,
	"pirate_defeated_at" timestamp with time zone,
	"probe_sent_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "newcomer_scenario_pirate_index_check" CHECK ("newcomer_scenario"."pirate_index" < 0)
);
--> statement-breakpoint
ALTER TABLE "newcomer_scenario" ADD CONSTRAINT "newcomer_scenario_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newcomer_scenario" ADD CONSTRAINT "newcomer_scenario_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "newcomer_scenario_pirate_index_idx" ON "newcomer_scenario" USING btree ("pirate_index");--> statement-breakpoint
CREATE INDEX "newcomer_scenario_season_step_idx" ON "newcomer_scenario" USING btree ("season_id","step");
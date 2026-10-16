CREATE TABLE "honor_events" (
	"season_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"evidence_hash" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"outcome" jsonb NOT NULL,
	CONSTRAINT "honor_events_season_id_source_source_id_pk" PRIMARY KEY("season_id","source","source_id"),
	CONSTRAINT "honor_events_source_check" CHECK ("honor_events"."source" IN ('WORLD', 'CLAN_WAR', 'MONUMENT', 'STRATEGIC_IMPACT', 'STRATEGIC_INTERCEPTION')),
	CONSTRAINT "honor_events_hash_check" CHECK (length("honor_events"."evidence_hash") = 64)
);
--> statement-breakpoint
CREATE TABLE "honor_seasons" (
	"season_id" uuid PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"mode" text NOT NULL,
	"catalogue" jsonb NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "honor_seasons_version_check" CHECK ("honor_seasons"."version" > 0),
	CONSTRAINT "honor_seasons_mode_check" CHECK ("honor_seasons"."mode" IN ('SHADOW', 'ACTIVE'))
);
--> statement-breakpoint
CREATE TABLE "honor_totals" (
	"season_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"score" bigint NOT NULL,
	CONSTRAINT "honor_totals_season_id_player_id_pk" PRIMARY KEY("season_id","player_id"),
	CONSTRAINT "honor_totals_score_check" CHECK ("honor_totals"."score" BETWEEN -9007199254740991 AND 9007199254740991)
);
--> statement-breakpoint
ALTER TABLE "honor_events" ADD CONSTRAINT "honor_events_season_id_honor_seasons_season_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."honor_seasons"("season_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honor_seasons" ADD CONSTRAINT "honor_seasons_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honor_totals" ADD CONSTRAINT "honor_totals_season_id_honor_seasons_season_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."honor_seasons"("season_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "honor_events_time_idx" ON "honor_events" USING btree ("season_id","at","source","source_id");--> statement-breakpoint
CREATE INDEX "honor_totals_rank_idx" ON "honor_totals" USING btree ("season_id","score");
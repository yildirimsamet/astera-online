CREATE TABLE "honor_commitments" (
	"season_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "honor_commitments_season_id_source_source_id_pk" PRIMARY KEY("season_id","source","source_id"),
	CONSTRAINT "honor_commitments_source_check" CHECK ("honor_commitments"."source" IN ('WORLD', 'CLAN_WAR', 'MONUMENT', 'STRATEGIC_IMPACT', 'STRATEGIC_INTERCEPTION'))
);
--> statement-breakpoint
ALTER TABLE "honor_commitments" ADD CONSTRAINT "honor_commitments_season_id_honor_seasons_season_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."honor_seasons"("season_id") ON DELETE cascade ON UPDATE no action;
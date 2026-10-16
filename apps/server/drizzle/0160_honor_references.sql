CREATE TABLE "honor_observations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"season_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"navy" bigint NOT NULL,
	"core_tier" integer NOT NULL,
	CONSTRAINT "honor_observations_values_check" CHECK ("honor_observations"."navy" BETWEEN 0 AND 9007199254740991 AND "honor_observations"."core_tier" > 0)
);
--> statement-breakpoint
ALTER TABLE "honor_observations" ADD CONSTRAINT "honor_observations_season_id_honor_seasons_season_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."honor_seasons"("season_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "honor_observations_owner_time_idx" ON "honor_observations" USING btree ("season_id","player_id","at","id");
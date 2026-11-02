CREATE TABLE "analytics_daily_aggregates" (
	"id" text PRIMARY KEY NOT NULL,
	"day" timestamp with time zone NOT NULL,
	"name" text NOT NULL,
	"mode" text NOT NULL,
	"events" integer NOT NULL,
	"visitors" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analytics_daily_day_idx" ON "analytics_daily_aggregates" USING btree ("day");
ALTER TYPE "public"."notification_kind" ADD VALUE 'radiation_lost';--> statement-breakpoint
CREATE TABLE "radiation_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"anchor_kind" text NOT NULL,
	"anchor_id" uuid,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"z" double precision NOT NULL,
	"radius" double precision NOT NULL,
	"intensity_pct_per_minute" double precision NOT NULL,
	"mode" text NOT NULL,
	"active_from" timestamp with time zone NOT NULL,
	"active_until" timestamp with time zone,
	"label" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "radiation_sources_radius_check" CHECK ("radiation_sources"."radius" > 0),
	CONSTRAINT "radiation_sources_intensity_check" CHECK ("radiation_sources"."intensity_pct_per_minute" >= 0),
	CONSTRAINT "radiation_sources_mode_check" CHECK ("radiation_sources"."mode" IN ('EMIT', 'SHELTER')),
	CONSTRAINT "radiation_sources_anchor_check" CHECK (("radiation_sources"."anchor_kind" = 'ZONE' AND "radiation_sources"."anchor_id" IS NULL)
    OR ("radiation_sources"."anchor_kind" = 'PLANET' AND "radiation_sources"."anchor_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "radiation_sources" ADD CONSTRAINT "radiation_sources_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "radiation_sources_season_idx" ON "radiation_sources" USING btree ("season_id");
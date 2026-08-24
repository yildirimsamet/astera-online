CREATE TABLE "planet_research" (
	"planet_id" uuid NOT NULL,
	"project_id" text NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "planet_research_planet_id_project_id_pk" PRIMARY KEY("planet_id","project_id")
);
--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "cargo_limited" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "shield_absorbed" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "planet_research" ADD CONSTRAINT "planet_research_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;
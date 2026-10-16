CREATE TABLE "planet_aegis_epochs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"level" integer NOT NULL,
	"active_from" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "shield_regen_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "planet_aegis_epochs" ADD CONSTRAINT "planet_aegis_epochs_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "planet_aegis_history_idx" ON "planet_aegis_epochs" USING btree ("planet_id","starts_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "planet_aegis_open_idx" ON "planet_aegis_epochs" USING btree ("planet_id") WHERE "planet_aegis_epochs"."ends_at" is null;

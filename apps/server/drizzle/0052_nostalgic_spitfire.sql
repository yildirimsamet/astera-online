ALTER TABLE "debris_fields" ALTER COLUMN "planet_id" DROP NOT NULL;--> statement-breakpoint
--
-- D150. A wreck field carries its own position now, because a pirate battle
-- happens at a rendezvous and open space has no planet to read coordinates from.
--
-- ADDED NULLABLE, BACKFILLED, THEN TIGHTENED. `drizzle-kit` writes these three as
-- a bare `ADD COLUMN ... NOT NULL`, which cannot run against a table that already
-- has rows — and `debris_fields` does on any live season. Every existing field is
-- anchored to a world, so its position is exactly that world's.
--
ALTER TABLE "debris_fields" ADD COLUMN "x" real;--> statement-breakpoint
ALTER TABLE "debris_fields" ADD COLUMN "y" real;--> statement-breakpoint
ALTER TABLE "debris_fields" ADD COLUMN "z" real;--> statement-breakpoint
UPDATE "debris_fields" AS d
   SET "x" = p."x", "y" = p."y", "z" = p."z"
  FROM "planets" AS p
 WHERE p."id" = d."planet_id";--> statement-breakpoint
-- Nothing should survive the backfill unanchored; a row that did would have no
-- world and no raid, and the CHECK below would refuse it anyway.
DELETE FROM "debris_fields" WHERE "x" IS NULL OR "y" IS NULL OR "z" IS NULL;--> statement-breakpoint
ALTER TABLE "debris_fields" ALTER COLUMN "x" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "debris_fields" ALTER COLUMN "y" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "debris_fields" ALTER COLUMN "z" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "debris_fields" ADD COLUMN "pirate_raid_id" uuid;--> statement-breakpoint
ALTER TABLE "debris_fields" ADD CONSTRAINT "debris_fields_pirate_raid_id_pirate_raids_id_fk" FOREIGN KEY ("pirate_raid_id") REFERENCES "public"."pirate_raids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debris_pirate_raid_idx" ON "debris_fields" USING btree ("pirate_raid_id");--> statement-breakpoint
ALTER TABLE "debris_fields" ADD CONSTRAINT "debris_fields_one_anchor" CHECK (("debris_fields"."planet_id" is not null and "debris_fields"."pirate_raid_id" is null)
        or ("debris_fields"."planet_id" is null and "debris_fields"."pirate_raid_id" is not null));

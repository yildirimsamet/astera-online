-- Ay F7b (§4.2): a broken moon's wreck is drawn beside the moon; collection still anchors at the world.
ALTER TABLE "debris_fields" ADD COLUMN "body" text DEFAULT 'PLANET' NOT NULL;--> statement-breakpoint
ALTER TABLE "debris_fields" ADD CONSTRAINT "debris_fields_body_check" CHECK ("debris_fields"."body" in ('PLANET', 'MOON'));
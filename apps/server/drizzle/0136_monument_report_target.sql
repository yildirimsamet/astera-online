ALTER TABLE "monument_battles" ADD COLUMN "monument_ordinal" integer;--> statement-breakpoint
ALTER TABLE "monument_battles" ADD COLUMN "monument_position" jsonb;--> statement-breakpoint
UPDATE "monument_battles" b SET "monument_ordinal" = m."ordinal",
  "monument_position" = jsonb_build_object('x', m."x", 'y', m."y", 'z', m."z")
FROM "monuments" m WHERE m."id" = b."monument_id";--> statement-breakpoint
ALTER TABLE "monument_battles" ALTER COLUMN "monument_ordinal" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "monument_battles" ALTER COLUMN "monument_position" SET NOT NULL;

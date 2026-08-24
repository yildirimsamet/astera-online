ALTER TABLE "probe_reports" ADD COLUMN "strategic_status" text;--> statement-breakpoint

-- CONTRACT PHASE. 0022 is intentionally safe to run while the old image is
-- still serving writes. Repeat every ownership backfill after those replicas are
-- drained so rows created during the compatibility window cannot strand NULLs.
UPDATE "battle_reports" AS br
SET "target_planet_id" = m."target_planet_id"
FROM "missions" AS m
WHERE m."id" = br."mission_id" AND br."target_planet_id" IS NULL;--> statement-breakpoint
UPDATE "missions" AS m
SET "owner_player_id" = p."player_id"
FROM "planets" AS p
WHERE m."owner_player_id" IS NULL AND p."id" = CASE
  WHEN m."kind" = 'return' OR m."parent_mission_id" IS NOT NULL
    THEN m."target_planet_id"
  ELSE m."origin_planet_id"
END;--> statement-breakpoint
UPDATE "units" AS u
SET "owner_player_id" = p."player_id"
FROM "planets" AS p
WHERE u."owner_player_id" IS NULL AND p."id" = u."planet_id";--> statement-breakpoint
UPDATE "watches" AS w
SET "observer_planet_id" = p."id"
FROM "planets" AS p
WHERE w."observer_planet_id" IS NULL AND p."player_id" = w."observer_player_id" AND p."kind" = 'CAPITAL';--> statement-breakpoint

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "battle_reports" WHERE "target_planet_id" IS NULL) THEN
    RAISE EXCEPTION 'multi-world contract: battle_reports.target_planet_id backfill incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM "missions" WHERE "owner_player_id" IS NULL) THEN
    RAISE EXCEPTION 'multi-world contract: missions.owner_player_id backfill incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM "watches" WHERE "observer_planet_id" IS NULL) THEN
    RAISE EXCEPTION 'multi-world contract: watches.observer_planet_id backfill incomplete';
  END IF;
END $$;--> statement-breakpoint

DROP INDEX "planets_player_idx";--> statement-breakpoint
ALTER TABLE "watches" DROP CONSTRAINT "watches_observer_player_id_slot_pk";--> statement-breakpoint
ALTER TABLE "battle_reports" ALTER COLUMN "target_planet_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "missions" ALTER COLUMN "owner_player_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "watches" ALTER COLUMN "observer_planet_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_observer_planet_id_slot_pk" PRIMARY KEY("observer_planet_id","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "planets_capital_player_idx" ON "planets" USING btree ("player_id") WHERE "planets"."kind" = 'CAPITAL';--> statement-breakpoint
CREATE INDEX "planets_controller_idx" ON "planets" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "watches_observer_player_idx" ON "watches" USING btree ("observer_player_id");

-- PLAN 2026-11-13 §6: THE SHIPS ABOARD MOVE TO THE NEW JUMP, which asks for no drive, part or fuel.
-- A ship already leaving (DEPARTING) finishes the way it started; nothing here touches it. Both
-- statements find nothing the second time, so the step is safe to run again.

-- The fuel in the tank goes back to the deuterium stock it was loaded from.
UPDATE "vessels" SET "deuterium" = "deuterium" + "fuel", "fuel" = 0
WHERE "fuel" > 0 AND "status" IN ('ACTIVE', 'DORMANT');
--> statement-breakpoint
-- A drive repair still in the queue is cancelled with everything back (not the half a cancel pays),
-- its finish is called off, and the repairs behind it move up as `reflow` moves them: the order in
-- hand keeps its times when it survives, otherwise the next one starts now.
WITH "drive" AS (
  SELECT o."id", o."vessel_id", o."cost" FROM "vessel_orders" o
  JOIN "vessels" v ON v."id" = o."vessel_id"
  WHERE o."status" = 'BUILDING' AND o."queue" = 'CONSTRUCTION' AND o."subject" IN ('DRIVE_HULL', 'DRIVE_THRUST')
    AND v."status" IN ('ACTIVE', 'DORMANT')
), "cancelled" AS (
  UPDATE "vessel_orders" SET "status" = 'CANCELLED' WHERE "id" IN (SELECT "id" FROM "drive") RETURNING "id"
), "called_off" AS (
  UPDATE "starter_events" SET "status" = 'done', "claimed_at" = NULL
  WHERE "kind" = 'vessel_order_complete' AND "status" IN ('pending', 'processing') AND "ref_id" IN (SELECT "id" FROM "drive")
  RETURNING "id"
), "refunded" AS (
  UPDATE "vessels" v SET
    "alloy" = v."alloy" + r."alloy", "crystal" = v."crystal" + r."crystal", "deuterium" = v."deuterium" + r."deuterium"
  FROM (
    SELECT "vessel_id", sum(("cost"->>'alloy')::float8) AS "alloy", sum(("cost"->>'crystal')::float8) AS "crystal",
      sum(coalesce(("cost"->>'deuterium')::float8, 0)) AS "deuterium"
    FROM "drive" GROUP BY "vessel_id"
  ) r WHERE v."id" = r."vessel_id"
  RETURNING v."id"
), "survivors" AS (
  SELECT o."id", o."slot", o."started_at", o."remaining_seconds",
    row_number() OVER w - 1 AS "new_slot",
    first_value(o."slot") OVER w AS "head_slot",
    first_value(o."ready_at") OVER w AS "head_ready",
    first_value(o."remaining_seconds") OVER w AS "head_seconds",
    sum(o."remaining_seconds") OVER w AS "through"
  FROM "vessel_orders" o
  WHERE o."status" = 'BUILDING' AND o."queue" = 'CONSTRUCTION' AND o."subject" NOT IN ('DRIVE_HULL', 'DRIVE_THRUST')
    AND o."vessel_id" IN (SELECT "vessel_id" FROM "drive")
  WINDOW w AS (PARTITION BY o."vessel_id" ORDER BY o."slot" ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
), "timed" AS (
  SELECT "id", "new_slot",
    CASE
      WHEN "head_slot" = 0 AND "new_slot" = 0 THEN "started_at"
      WHEN "head_slot" = 0 THEN "head_ready" + ("through" - "head_seconds" - "remaining_seconds") * interval '1 second'
      ELSE now() + ("through" - "remaining_seconds") * interval '1 second'
    END AS "started",
    CASE
      WHEN "head_slot" = 0 THEN "head_ready" + ("through" - "head_seconds") * interval '1 second'
      ELSE now() + "through" * interval '1 second'
    END AS "ready"
  FROM "survivors"
), "moved" AS (
  UPDATE "vessel_orders" o SET "slot" = t."new_slot", "started_at" = t."started", "ready_at" = t."ready"
  FROM "timed" t WHERE o."id" = t."id"
  RETURNING o."id"
)
UPDATE "starter_events" e SET "resolve_at" = t."ready"
FROM "timed" t
WHERE e."ref_id" = t."id" AND e."kind" = 'vessel_order_complete' AND e."status" IN ('pending', 'processing');

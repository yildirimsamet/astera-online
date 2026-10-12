-- Same-season cutover: stop all old API/worker writers before this transaction.
-- Old code would clamp the converted charge back to the previous capacity.
ALTER TABLE "satellites" ADD COLUMN IF NOT EXISTS "aegis_invested_value" double precision;
--> statement-breakpoint
-- Preserve the stored fill ratio at the effective level (installed Aegis capped
-- by Core). Do not advance last_tick_at: the new lazy tick still owes all elapsed
-- production and regeneration, including EMP's regeneration blackout.
-- The null investment identifies hardware that has not yet been converted.
WITH capacity AS (
  SELECT p.id,
         GREATEST(0, LEAST(s.level, COALESCE(c.level, 0))) AS level
    FROM planets p
    JOIN satellites s ON s.planet_id = p.id AND s.type = 'AEGIS'
    LEFT JOIN buildings c ON c.planet_id = p.id AND c.type = 'CORE'
   WHERE s.aegis_invested_value IS NULL
), limits AS (
  SELECT id,
         CASE WHEN level > 0 THEN floor(60 * power(1.5::double precision, level) + 0.5) ELSE 0 END AS old_max,
         CASE WHEN level > 0 THEN floor(150 * power(1.5::double precision, level - 1) + 0.5) ELSE 0 END AS new_max
    FROM capacity
)
UPDATE planets p
   SET shield = CASE WHEN l.old_max > 0
                    THEN GREATEST(0, LEAST(p.shield::double precision, l.old_max)) / l.old_max * l.new_max
                    ELSE 0 END
  FROM limits l
 WHERE p.id = l.id;
--> statement-breakpoint
-- Freeze the exact pre-cutover Aegis catalogue investment. Each component was
-- ceil(profileIncome(min(30, target_level * 2)) * hours * 2^current_level).
-- Stored investment also makes the data conversion safe to re-run: already
-- converted hardware is excluded from both updates.
UPDATE satellites s
   SET aegis_invested_value = COALESCE((
     SELECT sum(
       ceil(100 * power(LEAST(30, (r.level + 1) * 2)::double precision, 1.3) * (0.8 * power(2::double precision, r.level)))
       + ceil(50 * power(LEAST(30, (r.level + 1) * 2)::double precision, 1.3) * (1.2 * power(2::double precision, r.level)))
     )
       FROM generate_series(0, s.level - 1) AS r(level)
   ), 0)
 WHERE s.type = 'AEGIS' AND s.aegis_invested_value IS NULL;

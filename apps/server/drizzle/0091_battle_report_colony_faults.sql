-- WHAT A HEAVY DEFEAT BROKE ON THE DEFENDER'S COLONY. Koloni arızaları.
--
-- Owner decision: the faults a raid leaves are told in the battle report rather than as
-- separate notifications, which arrived beside `raided`, did not fold, and never said the
-- raid was their cause. Recorded at the battle rather than derived later because the
-- fault rows are repaired and deleted; a report has to remember what the fight did.
--
-- Expand-only with a default, so an older server writing reports and a newer one reading
-- them can overlap during a deploy.
ALTER TABLE "battle_reports" ADD COLUMN IF NOT EXISTS "colony_faults" jsonb DEFAULT '[]'::jsonb NOT NULL;

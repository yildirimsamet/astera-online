-- PLAN 2026-11-13 §5.6 (S2): THE DRIVE HAS NO REPAIRS ANY MORE. A finished drive repair is worth
-- nothing (§6), so the ship keeps nothing of it: its modules name only what the ladder still holds,
-- and the opening card once shown for the drive is forgotten. Both find nothing the second time.
-- The parts, fuel and part columns stay for now; nothing reads them, and dropping them waits for a
-- later release so a server still running the old code during the deploy keeps working.
UPDATE "vessels" SET "modules" = "modules" - 'DRIVE_HULL' - 'DRIVE_THRUST'
WHERE "modules" ?| ARRAY['DRIVE_HULL', 'DRIVE_THRUST'];
--> statement-breakpoint
UPDATE "vessels" SET "unlocks_seen" = "unlocks_seen" - 'drive'
WHERE "unlocks_seen" ? 'drive';

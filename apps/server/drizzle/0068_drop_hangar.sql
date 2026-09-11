-- D184: the Hangar is gone, so the rows that priced and levelled it are dead.
--
-- `buildings.type` and `build_orders.subject` are plain text with no constraint,
-- so nothing here is an enum change and nothing else has to move with it. A row
-- left behind would simply never be read again — it is deleted anyway, because a
-- level for a building that has no price is a row the next reader has to explain.
DELETE FROM "build_orders" WHERE "kind" = 'BUILDING' AND "subject" = 'HANGAR';
--> statement-breakpoint
DELETE FROM "buildings" WHERE "type" = 'HANGAR';

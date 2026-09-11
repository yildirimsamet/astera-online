-- D200: a Garbage Collector lifts part of its own battle's wreck on the way home.
-- The return leg and the pirate raid carry it beside their loot, never inside it:
-- loot feeds Dominion and the clan's docked share, salvage is Wealth and lands whole.
-- Nullable on both, because a flight with no collector carries none.
ALTER TABLE "missions" ADD COLUMN "salvage" jsonb;
--> statement-breakpoint
ALTER TABLE "pirate_raids" ADD COLUMN "salvage" jsonb;
--> statement-breakpoint
-- The report states it for every battle, so an old report reads zero rather than nothing.
ALTER TABLE "battle_reports" ADD COLUMN "salvage" jsonb DEFAULT '{"alloy":0,"crystal":0,"deuterium":0}'::jsonb NOT NULL;

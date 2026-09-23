ALTER TABLE "asteroid_spawn_hours" ADD COLUMN "eligible_players" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- An hour written before this column existed is not an empty galaxy. The rolling supply window
-- averages this figure, so leaving those hours at 0 would spawn the next five hours after a
-- mid-season deploy against a sixth of the galaxy. They take the figure they did spawn against.
UPDATE "asteroid_spawn_hours" SET "eligible_players" = "active_players" WHERE "eligible_players" = 0;

-- Existing seasons retain old earned production until the explicit idle NPC cutover.
-- New seasons initialize this epoch at their start. No unrelated ruleset is activated.
ALTER TABLE "seasons" ADD COLUMN "tempo_starts_at" timestamp with time zone;

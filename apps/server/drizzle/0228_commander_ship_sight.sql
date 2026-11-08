-- Physical commander-ship changes wake observers. The caller-filtered reads enforce sight.
-- NOTIFY is delivered on commit; no owner, position, resources or ship state is broadcast.
CREATE FUNCTION "astera_commander_ship_sight"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  galaxy uuid;
BEGIN
  SELECT season_id INTO galaxy FROM players WHERE id = NEW.player_id;
  IF galaxy IS NOT NULL THEN
    PERFORM pg_notify('astera_events', json_build_object('shard', galaxy, 'kind', 'shard:commander-ship')::text);
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER "commander_ship_sight_insert" AFTER INSERT ON "arena_ships"
  FOR EACH ROW EXECUTE FUNCTION "astera_commander_ship_sight"();
--> statement-breakpoint
CREATE TRIGGER "commander_ship_sight_update"
  AFTER UPDATE OF "ship", "level", "sortie_id", "admiral_id", "ready_at", "ready_notice_id" ON "arena_ships"
  FOR EACH ROW WHEN (
    (OLD.ship, OLD.level, OLD.sortie_id, OLD.admiral_id, OLD.ready_at)
      IS DISTINCT FROM (NEW.ship, NEW.level, NEW.sortie_id, NEW.admiral_id, NEW.ready_at)
    OR (OLD.ready_notice_id IS NOT NULL AND NEW.ready_notice_id IS NULL)
  ) EXECUTE FUNCTION "astera_commander_ship_sight"();

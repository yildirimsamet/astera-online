-- ANYTHING THAT ENDS A LIVE STREAM ANNOUNCES ITSELF. Scaling plan F1.1.
--
-- /api/stream reads a connection's epoch once and then delivers from memory, so the
-- changes that used to be caught by a read per frame are published here, in the
-- transaction that made them, on the bus channel (`CHANNEL` in src/stream/bus.ts).
-- A trigger cannot be forgotten by the next writer. The kinds are intercepted by the
-- stream route and never forwarded: 'private:auth' closes the socket (the reconnect
-- re-authenticates), 'placement_changed' is the frame transfers have always sent.
CREATE FUNCTION "astera_stream_revoke_account"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  account uuid;
BEGIN
  IF TG_TABLE_NAME = 'accounts' THEN
    account := NEW.id;
  ELSE
    account := NEW.account_id;
  END IF;
  PERFORM pg_notify('astera_events', json_build_object('playerId', p.id, 'kind', 'private:auth')::text)
    FROM "players" p WHERE p.account_id = account;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE FUNCTION "astera_stream_revoke_player"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM pg_notify('astera_events', json_build_object('playerId', OLD.id, 'kind', 'private:auth')::text);
  ELSE
    PERFORM pg_notify('astera_events', json_build_object('playerId', NEW.id, 'kind', 'placement_changed')::text);
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
-- Password reset, ban and deletion approval all bump auth_version.
CREATE TRIGGER "accounts_stream_revoke" AFTER UPDATE OF "auth_version" ON "accounts"
  FOR EACH ROW WHEN (OLD.auth_version IS DISTINCT FROM NEW.auth_version)
  EXECUTE FUNCTION "astera_stream_revoke_account"();
--> statement-breakpoint
CREATE TRIGGER "native_sessions_stream_revoke" AFTER UPDATE OF "revoked_at" ON "native_sessions"
  FOR EACH ROW WHEN (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL)
  EXECUTE FUNCTION "astera_stream_revoke_account"();
--> statement-breakpoint
CREATE TRIGGER "players_stream_placement" AFTER UPDATE OF "season_id", "placement_version" ON "players"
  FOR EACH ROW WHEN (OLD.season_id IS DISTINCT FROM NEW.season_id OR OLD.placement_version IS DISTINCT FROM NEW.placement_version)
  EXECUTE FUNCTION "astera_stream_revoke_player"();
--> statement-breakpoint
-- Reclaim and the season wipe delete commanders outright.
CREATE TRIGGER "players_stream_delete" AFTER DELETE ON "players"
  FOR EACH ROW EXECUTE FUNCTION "astera_stream_revoke_player"();

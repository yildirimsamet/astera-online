-- A SHIP'S STREAM ENDS THE WAY A COMMANDER'S DOES. Plan §5.6.
--
-- /api/stream subscribes to the ship's id on the same player topic, so the kinds are the ones
-- 0210 made: 'private:auth' closes the socket, 'placement_changed' tells the client first. A ship
-- has no `players` row to reach it through, so the account trigger also tells the account's ship,
-- and a ship leaving for its planet is what a transfer is to a commander.
CREATE OR REPLACE FUNCTION "astera_stream_revoke_account"() RETURNS trigger LANGUAGE plpgsql AS $$
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
  PERFORM pg_notify('astera_events', json_build_object('playerId', v.id, 'kind', 'private:auth')::text)
    FROM "vessels" v WHERE v.account_id = account;
  PERFORM pg_notify('astera_events', json_build_object('account', account, 'kind', 'account:auth')::text);
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE FUNCTION "astera_stream_revoke_vessel"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM pg_notify('astera_events', json_build_object('playerId', OLD.id, 'kind', 'private:auth')::text);
  ELSE
    PERFORM pg_notify('astera_events', json_build_object('playerId', NEW.id, 'kind', 'placement_changed')::text);
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER "vessels_stream_departed" AFTER UPDATE OF "status" ON "vessels"
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'DEPARTED')
  EXECUTE FUNCTION "astera_stream_revoke_vessel"();
--> statement-breakpoint
CREATE TRIGGER "vessels_stream_delete" AFTER DELETE ON "vessels"
  FOR EACH ROW EXECUTE FUNCTION "astera_stream_revoke_vessel"();

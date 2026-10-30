-- A TOKEN'S END IS ANNOUNCED FOR THE ACCOUNT TOO. Scaling plan F1.8 (C1).
--
-- 0210 told each of the account's commanders ('private:auth'), which is what a live
-- stream needs. A request's identity check is now cached per process, and an account
-- with no commander (not placed yet, or between seasons) had nobody to tell. The same
-- trigger now also says 'account:auth' for the account itself, and erasing the row
-- says it as well: the row is gone with no version to bump. The bus never forwards an
-- account event to a client; only the identity cache listens.
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
  PERFORM pg_notify('astera_events', json_build_object('account', account, 'kind', 'account:auth')::text);
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE FUNCTION "astera_account_erased"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('astera_events', json_build_object('account', OLD.id, 'kind', 'account:auth')::text);
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER "accounts_erased" AFTER DELETE ON "accounts"
  FOR EACH ROW EXECUTE FUNCTION "astera_account_erased"();

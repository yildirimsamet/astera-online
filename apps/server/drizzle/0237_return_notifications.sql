ALTER TABLE push_devices ADD COLUMN utc_offset_minutes integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE push_devices ADD CONSTRAINT push_devices_offset_check CHECK (utc_offset_minutes BETWEEN -840 AND 840);
--> statement-breakpoint
CREATE TABLE deferred_pushes (
  id text PRIMARY KEY,
  token text NOT NULL CONSTRAINT deferred_pushes_token_push_devices_token_fk REFERENCES push_devices(token) ON DELETE CASCADE,
  account_id uuid NOT NULL CONSTRAINT deferred_pushes_account_id_accounts_id_fk REFERENCES accounts(id) ON DELETE CASCADE,
  message jsonb NOT NULL,
  deliver_at timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX deferred_pushes_due_idx ON deferred_pushes(deliver_at);

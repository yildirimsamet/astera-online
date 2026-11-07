ALTER TYPE starter_event_kind ADD VALUE IF NOT EXISTS 'vessel_repair_notice' BEFORE 'vessel_mission_arrival';
--> statement-breakpoint
ALTER TYPE starter_event_kind ADD VALUE IF NOT EXISTS 'vessel_push' BEFORE 'vessel_mission_arrival';
--> statement-breakpoint
CREATE TABLE return_reminders (
 account_id uuid PRIMARY KEY CONSTRAINT return_reminders_account_id_accounts_id_fk REFERENCES accounts(id) ON DELETE CASCADE,
 vessel_id uuid, planet_id uuid, subject text, next_repair_at timestamptz, last_funded_at timestamptz,
 absence_at timestamptz NOT NULL, summary_stage integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX return_reminders_due_idx ON return_reminders(next_repair_at);

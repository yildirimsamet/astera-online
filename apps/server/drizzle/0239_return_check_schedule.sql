ALTER TABLE vessel_migrations ADD COLUMN completed_at timestamptz;
--> statement-breakpoint
UPDATE vessel_migrations m SET completed_at = coalesce((SELECT max(d.at) FROM starter_departures d JOIN vessels v ON v.account_id = d.account_id WHERE v.id = m.vessel_id), started_at) WHERE status = 'DONE';
--> statement-breakpoint
ALTER TABLE return_reminders ADD COLUMN next_check_at timestamptz;
--> statement-breakpoint
UPDATE return_reminders SET next_check_at = least(next_repair_at, CASE WHEN summary_stage = 0 THEN absence_at + interval '24 hours' WHEN summary_stage = 1 THEN absence_at + interval '72 hours' END);
--> statement-breakpoint
CREATE INDEX return_reminders_check_idx ON return_reminders(next_check_at);

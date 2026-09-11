-- D199: a probe also reads the shape of the wall, the Aegis charge and the unarmed
-- hulls in the line. Nullable, because every report written before this has none of
-- them — and absent is a reading never taken, not a reading of zero.
ALTER TABLE "probe_reports" ADD COLUMN "class_reading" jsonb;
--> statement-breakpoint
ALTER TABLE "probe_reports" ADD COLUMN "shield" jsonb;
--> statement-breakpoint
ALTER TABLE "probe_reports" ADD COLUMN "unarmed" jsonb;

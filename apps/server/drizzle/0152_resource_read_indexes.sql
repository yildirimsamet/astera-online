-- Resource analysis 2026-10-13: two hot reads had no index that leads with the searched column.
-- Journal `when` sits just after 0151 (live in production): drizzle skips any migration
-- older than the newest applied one.
CREATE INDEX "missions_owner_kind_depart_idx" ON "missions" USING btree ("owner_player_id","kind","depart_at");--> statement-breakpoint
CREATE INDEX "units_location_idx" ON "units" USING btree ("location");
CREATE INDEX IF NOT EXISTS "vessel_migrations_player_idx" ON "vessel_migrations" ("player_id") WHERE "status" = 'DONE';

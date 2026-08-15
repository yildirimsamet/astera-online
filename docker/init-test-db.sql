-- The test suite truncates every table between tests. If it shares a database with
-- local development, running `pnpm verify` deletes the season you were playing —
-- which happened, on the day the client became playable.
CREATE DATABASE blindspace_test;

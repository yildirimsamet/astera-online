-- Candidate seasons freeze prices on creation; no historical price is invented.
ALTER TABLE "honor_seasons" ADD COLUMN "strategic_catalogue" jsonb;

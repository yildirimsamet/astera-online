ALTER TABLE "asteroid_spawn_hours"
ADD COLUMN "level_weights" jsonb DEFAULT '[0, 0.4, 0.27, 0.18, 0.1, 0.05]'::jsonb NOT NULL;

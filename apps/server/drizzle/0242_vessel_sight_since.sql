ALTER TABLE "vessels" ADD COLUMN "sight_since" timestamp with time zone DEFAULT now() NOT NULL;

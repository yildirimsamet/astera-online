ALTER TABLE "vessels" ADD COLUMN "last_progress_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "vessels" SET "last_progress_at" = "last_seen_at";--> statement-breakpoint
CREATE INDEX "vessels_quiet_idx" ON "vessels" USING btree ("last_progress_at") WHERE "vessels"."status" = 'ACTIVE';
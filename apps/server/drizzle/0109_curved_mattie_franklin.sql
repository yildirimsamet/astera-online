ALTER TABLE "missions" ADD COLUMN "recalled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "recall_from" jsonb;
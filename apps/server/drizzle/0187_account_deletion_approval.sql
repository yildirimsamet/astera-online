ALTER TABLE "account_deletion_requests" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "deletion_approved_at" timestamp with time zone;
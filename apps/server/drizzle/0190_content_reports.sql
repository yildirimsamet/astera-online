CREATE TABLE "content_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_account_id" uuid NOT NULL,
	"target_account_id" uuid,
	"target_key" text NOT NULL,
	"kind" text NOT NULL,
	"channel" text,
	"message_id" uuid,
	"reason" text NOT NULL,
	"details" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"moderator_account_id" uuid,
	CONSTRAINT "content_reports_kind_check" CHECK ("content_reports"."kind" in ('message', 'player')),
	CONSTRAINT "content_reports_channel_check" CHECK ("content_reports"."channel" in ('general', 'clan', 'dm')),
	CONSTRAINT "content_reports_reason_check" CHECK ("content_reports"."reason" in ('SPAM', 'HARASSMENT', 'HATE', 'SEXUAL', 'VIOLENCE', 'INAPPROPRIATE_NAME', 'OTHER')),
	CONSTRAINT "content_reports_details_check" CHECK (char_length("content_reports"."details") <= 1000),
	CONSTRAINT "content_reports_status_check" CHECK ("content_reports"."status" in ('PENDING', 'RESOLVED', 'DISMISSED'))
);
--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_account_id_accounts_id_fk" FOREIGN KEY ("reporter_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_target_account_id_accounts_id_fk" FOREIGN KEY ("target_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_moderator_account_id_accounts_id_fk" FOREIGN KEY ("moderator_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_reports_reporter_target_idx" ON "content_reports" USING btree ("reporter_account_id","target_key");--> statement-breakpoint
CREATE INDEX "content_reports_queue_idx" ON "content_reports" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "content_reports_retention_idx" ON "content_reports" USING btree ("created_at");
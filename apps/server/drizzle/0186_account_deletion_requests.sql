CREATE TABLE "account_deletion_requests" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"request_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"locale" text NOT NULL,
	CONSTRAINT "account_deletion_requests_locale_check" CHECK ("account_deletion_requests"."locale" in ('en', 'tr', 'fr', 'de', 'es', 'ja'))
);
--> statement-breakpoint
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_requests_receipt_idx" ON "account_deletion_requests" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "account_deletion_requests_queue_idx" ON "account_deletion_requests" USING btree ("requested_at");
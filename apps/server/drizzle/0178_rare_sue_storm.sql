CREATE TABLE "mail_outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"operation_id" uuid,
	"code_hash" text,
	"recipient_key" text NOT NULL,
	"payload" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_suppressions" (
	"recipient_key" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_counters" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_operations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"purpose" text NOT NULL,
	"target" text NOT NULL,
	"code_hash" text NOT NULL,
	"locale" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"resend_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mail_outbox" ADD CONSTRAINT "mail_outbox_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_outbox" ADD CONSTRAINT "mail_outbox_operation_id_security_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."security_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_operations" ADD CONSTRAINT "security_operations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mail_outbox_due_idx" ON "mail_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mail_outbox_provider_idx" ON "mail_outbox" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "security_operations_account_idx" ON "security_operations" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "security_operations_expiry_idx" ON "security_operations" USING btree ("expires_at");
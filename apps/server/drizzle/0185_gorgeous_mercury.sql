CREATE TABLE "native_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"refresh_hash" text NOT NULL,
	"previous_hash" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "native_sessions" ADD CONSTRAINT "native_sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "native_sessions_account_idx" ON "native_sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "native_sessions_expiry_idx" ON "native_sessions" USING btree ("expires_at");
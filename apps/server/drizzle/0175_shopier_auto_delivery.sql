CREATE TABLE "shopier_orders" (
	"order_id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"item_id" text,
	"account_id" uuid,
	"code" text,
	"note" text,
	"total" text,
	"currency" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shopier_purchase_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"item_id" text NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"order_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shopier_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shopier_orders" ADD CONSTRAINT "shopier_orders_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopier_purchase_codes" ADD CONSTRAINT "shopier_purchase_codes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shopier_orders_status_idx" ON "shopier_orders" USING btree ("status","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shopier_purchase_codes_code_idx" ON "shopier_purchase_codes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "shopier_purchase_codes_open_idx" ON "shopier_purchase_codes" USING btree ("account_id","item_id") WHERE "shopier_purchase_codes"."status" = 'OPEN' AND "shopier_purchase_codes"."account_id" IS NOT NULL;
CREATE TABLE "polar_reversals" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polar_skin_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"item_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"checkout_id" uuid,
	"checkout_url" text,
	"order_id" uuid,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "polar_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "polar_skin_orders" ADD CONSTRAINT "polar_skin_orders_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "polar_skin_orders_checkout_idx" ON "polar_skin_orders" USING btree ("checkout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "polar_skin_orders_order_idx" ON "polar_skin_orders" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "polar_skin_orders_pending_idx" ON "polar_skin_orders" USING btree ("account_id","item_id") WHERE "polar_skin_orders"."status" = 'PENDING' AND "polar_skin_orders"."account_id" IS NOT NULL;

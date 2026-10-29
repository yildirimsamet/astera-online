CREATE TABLE "shopier_checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"item_id" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"product_id" text,
	"url" text,
	"order_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
DROP TABLE "shopier_purchase_codes" CASCADE;--> statement-breakpoint
ALTER TABLE "shopier_orders" ADD COLUMN "checkout_id" uuid;--> statement-breakpoint
ALTER TABLE "shopier_checkouts" ADD CONSTRAINT "shopier_checkouts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shopier_checkouts_product_idx" ON "shopier_checkouts" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shopier_checkouts_live_idx" ON "shopier_checkouts" USING btree ("account_id","item_id") WHERE "shopier_checkouts"."status" IN ('PENDING', 'OPEN') AND "shopier_checkouts"."account_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "shopier_checkouts_status_idx" ON "shopier_checkouts" USING btree ("status","expires_at");--> statement-breakpoint
ALTER TABLE "shopier_orders" ADD CONSTRAINT "shopier_orders_checkout_id_shopier_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."shopier_checkouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopier_orders" DROP COLUMN "code";
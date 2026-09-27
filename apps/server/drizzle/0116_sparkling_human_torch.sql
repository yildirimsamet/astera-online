CREATE TABLE IF NOT EXISTS "paddle_reversals" (
	"transaction_id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "paddle_skin_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"skin_id" text NOT NULL,
	"price_id" text NOT NULL,
	"transaction_id" text,
	"customer_id" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "paddle_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "paddle_skin_orders" ADD COLUMN IF NOT EXISTS "customer_id" text;--> statement-breakpoint
ALTER TABLE "cosmetic_entitlements" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paddle_skin_orders_account_id_accounts_id_fk') THEN
    ALTER TABLE "paddle_skin_orders" ADD CONSTRAINT "paddle_skin_orders_account_id_accounts_id_fk"
      FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "paddle_skin_orders_transaction_idx" ON "paddle_skin_orders" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "paddle_skin_orders_pending_idx" ON "paddle_skin_orders" USING btree ("account_id","skin_id") WHERE "paddle_skin_orders"."status" = 'PENDING' AND "paddle_skin_orders"."account_id" IS NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "cosmetic_entitlements_account_cosmetic_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "cosmetic_entitlements_account_cosmetic_idx" ON "cosmetic_entitlements" USING btree ("account_id","cosmetic_id") WHERE "cosmetic_entitlements"."revoked_at" IS NULL;

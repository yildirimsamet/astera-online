CREATE TABLE "cosmetic_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"cosmetic_id" text NOT NULL,
	"source" text NOT NULL,
	"order_ref" text NOT NULL,
	"granted_by_account_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "equipped_skin_id" text;--> statement-breakpoint
ALTER TABLE "cosmetic_entitlements" ADD CONSTRAINT "cosmetic_entitlements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cosmetic_entitlements" ADD CONSTRAINT "cosmetic_entitlements_granted_by_account_id_accounts_id_fk" FOREIGN KEY ("granted_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cosmetic_entitlements_account_cosmetic_idx" ON "cosmetic_entitlements" USING btree ("account_id","cosmetic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cosmetic_entitlements_order_idx" ON "cosmetic_entitlements" USING btree ("source","order_ref");

ALTER TABLE "accounts" ADD COLUMN "legacy_email" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "auth_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Unused legacy addresses are not proof of ownership. Preserve without enabling email login.
UPDATE "accounts" SET "legacy_email" = "email", "email" = NULL WHERE "email" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_verified_email_check" CHECK (("accounts"."email" IS NULL) = ("accounts"."email_verified_at" IS NULL));--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_email_canonical_check" CHECK ("accounts"."email" = lower(trim("accounts"."email")));--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_auth_version_check" CHECK ("accounts"."auth_version" >= 0);
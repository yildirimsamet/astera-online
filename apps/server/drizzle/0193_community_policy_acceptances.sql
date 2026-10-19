CREATE TABLE "community_policy_acceptances" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"locale" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "community_policy_locale_check" CHECK ("community_policy_acceptances"."locale" in ('en','tr','de','fr','es','ja'))
);
--> statement-breakpoint
ALTER TABLE "community_policy_acceptances" ADD CONSTRAINT "community_policy_acceptances_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
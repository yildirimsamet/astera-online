CREATE TABLE "arena_pilots" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"granted_by_account_id" uuid,
	"granted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arena_pilots" ADD CONSTRAINT "arena_pilots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_pilots" ADD CONSTRAINT "arena_pilots_granted_by_account_id_accounts_id_fk" FOREIGN KEY ("granted_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
CREATE TABLE "community_blocks" (
	"blocker_account_id" uuid NOT NULL,
	"target_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "community_blocks_blocker_account_id_target_account_id_pk" PRIMARY KEY("blocker_account_id","target_account_id"),
	CONSTRAINT "community_blocks_distinct_check" CHECK ("community_blocks"."blocker_account_id" <> "community_blocks"."target_account_id")
);
--> statement-breakpoint
ALTER TABLE "community_blocks" ADD CONSTRAINT "community_blocks_blocker_account_id_accounts_id_fk" FOREIGN KEY ("blocker_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_blocks" ADD CONSTRAINT "community_blocks_target_account_id_accounts_id_fk" FOREIGN KEY ("target_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "community_blocks_target_idx" ON "community_blocks" USING btree ("target_account_id");
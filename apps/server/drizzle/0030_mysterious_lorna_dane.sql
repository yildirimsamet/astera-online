CREATE TABLE "account_rewards" (
	"account_id" uuid NOT NULL,
	"reward_id" text NOT NULL,
	"alloy" real DEFAULT 0 NOT NULL,
	"crystal" real DEFAULT 0 NOT NULL,
	"deuterium" real DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_rewards_account_id_reward_id_pk" PRIMARY KEY("account_id","reward_id")
);
--> statement-breakpoint
ALTER TABLE "account_rewards" ADD CONSTRAINT "account_rewards_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- THE FOLLOW BONUS MOVES UP A LEVEL, AND THE PEOPLE WHO ALREADY HAVE IT KEEP IT.
--
-- Without this the new table starts empty, which reads as "nobody has ever been
-- paid" — so every commander who was granted or has already taken the @JoinAstera
-- bonus in the live season could be granted it again, which is the exact bug this
-- migration exists to close. The row is carried over with its `claimed_at`
-- intact, so a taken bonus stays taken and a granted-but-unclaimed one stays
-- claimable.
INSERT INTO "account_rewards" ("account_id", "reward_id", "alloy", "crystal", "deuterium", "claimed_at", "created_at")
SELECT "players"."account_id", "reward_grants"."reward_id", "reward_grants"."alloy",
       "reward_grants"."crystal", "reward_grants"."deuterium", "reward_grants"."claimed_at",
       "reward_grants"."created_at"
FROM "reward_grants"
JOIN "players" ON "players"."id" = "reward_grants"."player_id"
WHERE "reward_grants"."reward_id" LIKE 'SOCIAL:%'
ON CONFLICT ("account_id", "reward_id") DO NOTHING;--> statement-breakpoint
-- One source of truth. A stale player-scoped row left behind would be read by
-- nothing, but "read by nothing" is a property of today's code rather than of the
-- data, and two records of one payment is how a double payment starts.
DELETE FROM "reward_grants" WHERE "reward_id" LIKE 'SOCIAL:%';

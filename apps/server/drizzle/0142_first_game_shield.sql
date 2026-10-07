SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "first_game_shield_available" boolean DEFAULT false NOT NULL;

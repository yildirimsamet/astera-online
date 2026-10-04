ALTER TABLE "monument_battle_participants" ADD COLUMN "commander_name" text DEFAULT 'Unknown commander' NOT NULL;--> statement-breakpoint
ALTER TABLE "monument_battle_participants" ADD COLUMN "clan_name" text;--> statement-breakpoint
ALTER TABLE "monument_battle_participants" ADD COLUMN "clan_tag" text;
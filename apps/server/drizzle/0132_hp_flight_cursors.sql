ALTER TABLE "clan_support_waves" ADD COLUMN "radiation_settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clan_war_contributions" ADD COLUMN "radiation_settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "radiation_settled_at" timestamp with time zone;
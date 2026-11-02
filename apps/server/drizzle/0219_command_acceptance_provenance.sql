ALTER TABLE "build_orders" ADD COLUMN "ordered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "build_orders" ADD COLUMN "origin" text DEFAULT 'legacy_unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "build_orders" ADD COLUMN "actor_account_id" uuid;--> statement-breakpoint
ALTER TABLE "build_orders" ADD COLUMN "actor_player_id" uuid;--> statement-breakpoint
ALTER TABLE "build_orders" ADD COLUMN "actor_season_id" uuid;--> statement-breakpoint
ALTER TABLE "build_orders" ADD COLUMN "analytics_visit_hash" text;--> statement-breakpoint
ALTER TABLE "research_orders" ADD COLUMN "ordered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "research_orders" ADD COLUMN "origin" text DEFAULT 'legacy_unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "research_orders" ADD COLUMN "actor_account_id" uuid;--> statement-breakpoint
ALTER TABLE "research_orders" ADD COLUMN "actor_player_id" uuid;--> statement-breakpoint
ALTER TABLE "research_orders" ADD COLUMN "actor_season_id" uuid;--> statement-breakpoint
ALTER TABLE "research_orders" ADD COLUMN "analytics_visit_hash" text;--> statement-breakpoint
ALTER TABLE "build_orders" ADD CONSTRAINT "build_orders_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_orders" ADD CONSTRAINT "research_orders_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
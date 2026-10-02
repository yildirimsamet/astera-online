CREATE TABLE "ship_damage_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"hull" text NOT NULL,
	"damage_bp" integer NOT NULL,
	"repair_order_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ship_damage_lots_damage_check" CHECK ("ship_damage_lots"."damage_bp" BETWEEN 2001 AND 9999)
);
--> statement-breakpoint
ALTER TABLE "build_orders" DROP CONSTRAINT "build_orders_queue_check";--> statement-breakpoint
ALTER TABLE "build_orders" DROP CONSTRAINT "build_orders_kind_check";--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "attacker_damage" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "defender_damage" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "clan_war_contributions" ADD COLUMN "damage" jsonb;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "damage" jsonb;--> statement-breakpoint
ALTER TABLE "pirate_raids" ADD COLUMN "damage" jsonb;--> statement-breakpoint
ALTER TABLE "ship_damage_lots" ADD CONSTRAINT "ship_damage_lots_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ship_damage_lots" ADD CONSTRAINT "ship_damage_lots_repair_order_id_build_orders_id_fk" FOREIGN KEY ("repair_order_id") REFERENCES "public"."build_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ship_damage_lots_planet_idx" ON "ship_damage_lots" USING btree ("planet_id");--> statement-breakpoint
CREATE INDEX "ship_damage_lots_repair_order_idx" ON "ship_damage_lots" USING btree ("repair_order_id");--> statement-breakpoint
ALTER TABLE "build_orders" ADD CONSTRAINT "build_orders_queue_check" CHECK ("build_orders"."queue" IN ('CONSTRUCTION', 'YARD', 'REPAIR'));--> statement-breakpoint
ALTER TABLE "build_orders" ADD CONSTRAINT "build_orders_kind_check" CHECK ("build_orders"."kind" IN ('BUILDING', 'HULL', 'INSTRUMENT', 'SATELLITE', 'RESEARCH', 'REPAIR'));
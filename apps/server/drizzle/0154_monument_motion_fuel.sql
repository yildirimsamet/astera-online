ALTER TABLE "clan_war_contributions" ADD COLUMN "monument_fuel_budget" jsonb;--> statement-breakpoint
ALTER TABLE "monument_ship_lots" ADD COLUMN "return_fuel_reserve" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "monument_ship_lots" ADD COLUMN "fuel_refund" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "monument_motion_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "monument_ship_lots" ADD CONSTRAINT "monument_ship_lots_fuel_check" CHECK ("monument_ship_lots"."return_fuel_reserve" >= 0 AND "monument_ship_lots"."return_fuel_reserve" < 'Infinity'::float8
    AND "monument_ship_lots"."fuel_refund" >= 0 AND "monument_ship_lots"."fuel_refund" < 'Infinity'::float8);
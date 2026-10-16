ALTER TABLE "ship_damage_lots" DROP CONSTRAINT "ship_damage_lots_damage_check";--> statement-breakpoint
ALTER TABLE "ship_damage_lots" ADD CONSTRAINT "ship_damage_lots_damage_check" CHECK ("ship_damage_lots"."damage_bp" BETWEEN 0 AND 9999
    AND ("ship_damage_lots"."damage_bp" > 0 OR "ship_damage_lots"."remainder_bp" > 0)
    AND "ship_damage_lots"."remainder_bp" >= 0 AND "ship_damage_lots"."remainder_bp" < 1);
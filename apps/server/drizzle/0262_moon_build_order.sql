-- Ay V34 slice (S8, V29, plan §6.4): a Common moon is a CONSTRUCTION-line order of its own kind.
ALTER TABLE "build_orders" DROP CONSTRAINT "build_orders_kind_check";--> statement-breakpoint
ALTER TABLE "build_orders" ADD CONSTRAINT "build_orders_kind_check" CHECK ("build_orders"."kind" IN ('BUILDING', 'HULL', 'INSTRUMENT', 'SATELLITE', 'RESEARCH', 'REPAIR', 'MOON'));
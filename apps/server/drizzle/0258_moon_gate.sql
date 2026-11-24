-- Ay F4 (§4.1, §6.11): Moon Gate jumps share the hop table; a jump pays fuel and may end CANCELLED or LOST.
ALTER TABLE "moon_moves" DROP CONSTRAINT "moon_moves_kind_check";--> statement-breakpoint
ALTER TABLE "moon_moves" DROP CONSTRAINT "moon_moves_status_check";--> statement-breakpoint
ALTER TABLE "moon_moves" ADD COLUMN "fuel_paid" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "moon_moves" ADD CONSTRAINT "moon_moves_kind_check" CHECK ("moon_moves"."kind" in ('HOP_UP', 'HOP_DOWN', 'JUMP'));--> statement-breakpoint
ALTER TABLE "moon_moves" ADD CONSTRAINT "moon_moves_status_check" CHECK ("moon_moves"."status" in ('PENDING', 'LANDED', 'RETURNED', 'CANCELLED', 'LOST'));
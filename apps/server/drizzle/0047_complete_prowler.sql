ALTER TYPE "public"."event_kind" ADD VALUE 'research_complete';--> statement-breakpoint
CREATE TABLE "research_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"funding_planet_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"project_id" text NOT NULL,
	"level" integer NOT NULL,
	"status" text DEFAULT 'BUILDING' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ready_at" timestamp with time zone NOT NULL,
	"remaining_seconds" integer NOT NULL,
	"cost" jsonb NOT NULL,
	CONSTRAINT "research_orders_status_check" CHECK ("research_orders"."status" IN ('BUILDING', 'COMPLETED', 'CANCELLED', 'FAILED')),
	CONSTRAINT "research_orders_slot_check" CHECK ("research_orders"."slot" BETWEEN 0 AND 2),
	CONSTRAINT "research_orders_level_check" CHECK ("research_orders"."level" > 0),
	CONSTRAINT "research_orders_remaining_check" CHECK ("research_orders"."remaining_seconds" >= 0)
);
--> statement-breakpoint
ALTER TABLE "research_orders" ADD CONSTRAINT "research_orders_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_orders" ADD CONSTRAINT "research_orders_funding_planet_id_planets_id_fk" FOREIGN KEY ("funding_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "research_orders_player_slot_active_idx" ON "research_orders" USING btree ("player_id","slot") WHERE "research_orders"."status" = 'BUILDING';--> statement-breakpoint
CREATE INDEX "research_orders_player_status_idx" ON "research_orders" USING btree ("player_id","status");--> statement-breakpoint
CREATE INDEX "research_orders_funding_planet_idx" ON "research_orders" USING btree ("funding_planet_id");--> statement-breakpoint
INSERT INTO "research_orders" (
	"id", "player_id", "funding_planet_id", "slot", "project_id", "level", "status",
	"started_at", "ready_at", "remaining_seconds", "cost"
)
SELECT b."id", p."player_id", b."planet_id",
	row_number() OVER (PARTITION BY p."player_id" ORDER BY b."ready_at", b."id") - 1,
	b."subject", b."count", b."status", b."started_at", b."ready_at",
	b."remaining_seconds", b."cost"
FROM "build_orders" b
JOIN "planets" p ON p."id" = b."planet_id"
WHERE b."kind" = 'RESEARCH' AND b."status" = 'BUILDING'
	AND p."player_id" IS NOT NULL;--> statement-breakpoint
UPDATE "build_orders"
SET "status" = 'CANCELLED'
WHERE "kind" = 'RESEARCH' AND "status" = 'BUILDING';--> statement-breakpoint
DROP INDEX "build_orders_planet_queue_slot_active_idx";--> statement-breakpoint
WITH compact AS (
	SELECT "id", row_number() OVER (
		PARTITION BY "planet_id", "queue" ORDER BY "slot", "id"
	) - 1 AS next_slot
	FROM "build_orders"
	WHERE "status" = 'BUILDING'
)
UPDATE "build_orders" b
SET "slot" = compact.next_slot
FROM compact
WHERE b."id" = compact."id";--> statement-breakpoint
CREATE UNIQUE INDEX "build_orders_planet_queue_slot_active_idx"
	ON "build_orders" USING btree ("planet_id","queue","slot")
	WHERE "build_orders"."status" = 'BUILDING';

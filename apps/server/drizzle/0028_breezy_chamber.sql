CREATE TABLE "build_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"queue" text NOT NULL,
	"slot" integer NOT NULL,
	"kind" text NOT NULL,
	"subject" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'BUILDING' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ready_at" timestamp with time zone NOT NULL,
	"remaining_seconds" integer NOT NULL,
	"cost" jsonb NOT NULL,
	CONSTRAINT "build_orders_queue_check" CHECK ("build_orders"."queue" IN ('CONSTRUCTION', 'YARD')),
	CONSTRAINT "build_orders_kind_check" CHECK ("build_orders"."kind" IN ('BUILDING', 'HULL', 'INSTRUMENT', 'SATELLITE', 'RESEARCH')),
	CONSTRAINT "build_orders_status_check" CHECK ("build_orders"."status" IN ('BUILDING', 'COMPLETED', 'CANCELLED', 'FAILED')),
	CONSTRAINT "build_orders_slot_check" CHECK ("build_orders"."slot" BETWEEN 0 AND 2),
	CONSTRAINT "build_orders_count_check" CHECK ("build_orders"."count" > 0),
	CONSTRAINT "build_orders_remaining_check" CHECK ("build_orders"."remaining_seconds" >= 0)
);
--> statement-breakpoint
ALTER TABLE "build_orders" ADD CONSTRAINT "build_orders_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "build_orders_planet_queue_slot_active_idx" ON "build_orders" USING btree ("planet_id","queue","slot") WHERE "build_orders"."status" = 'BUILDING';--> statement-breakpoint
CREATE INDEX "build_orders_planet_status_idx" ON "build_orders" USING btree ("planet_id","status");
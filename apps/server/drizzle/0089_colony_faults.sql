-- KOLONİ ARIZALARI. docs/colony-faults-plan.md
--
-- A colony nobody looks after breaks: eight faults arrive at random, each shutting
-- one capability off, and while they stand the world's loyalty falls. At zero it
-- secedes and goes NEUTRAL.
--
-- Enum values go on the END of their type. Postgres stores an enum value's sort
-- order by declaration position, so inserting one in the middle rebuilds the type
-- and every column that uses it.
ALTER TYPE "public"."event_kind" ADD VALUE IF NOT EXISTS 'fault_spawn';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE IF NOT EXISTS 'fault_repair_complete';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE IF NOT EXISTS 'vault_leak_flush';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE IF NOT EXISTS 'colony_secession';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'colony_fault';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'colony_loyalty_warning';--> statement-breakpoint

-- Loyalty is lazy, anchored to the same `last_tick_at` the economy uses. A world
-- below the Core gate carries the full value and never spends it.
ALTER TABLE "planets" ADD COLUMN IF NOT EXISTS "loyalty" real DEFAULT 100 NOT NULL;--> statement-breakpoint

-- What has leaked and is waiting to become a PUBLIC debris field. Emptied only by
-- `vault_leak_flush`; see the plan for why the flush is an event and not lazy.
ALTER TABLE "planets" ADD COLUMN IF NOT EXISTS "pending_leak_alloy" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN IF NOT EXISTS "pending_leak_crystal" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN IF NOT EXISTS "pending_leak_deuterium" real DEFAULT 0 NOT NULL;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "planet_faults" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "planet_id" uuid NOT NULL REFERENCES "planets"("id"),
  "kind" text NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  -- Which spawn event wrote this row, and it is here for idempotence alone. The draw is
  -- seeded from the event id and so repeats, but it draws from the faults NOT already
  -- standing — after the first run that pool is one shorter, so the same number lands on
  -- a different fault. Determinism over a moving set is not idempotence; this is.
  "spawn_event_id" uuid,
  -- Per-occurrence, so a repaired and re-broken vault starts its ceiling again.
  "leaked_alloy" real DEFAULT 0 NOT NULL,
  "leaked_crystal" real DEFAULT 0 NOT NULL,
  "leaked_deuterium" real DEFAULT 0 NOT NULL,
  "repair_slot" integer,
  "repair_started_at" timestamp with time zone,
  "repair_ready_at" timestamp with time zone,
  "repair_cost" jsonb,
  CONSTRAINT "planet_faults_kind_check" CHECK ("kind" IN (
    'REFINERY_OUTAGE', 'EXTRACTOR_OUTAGE', 'PLANT_OUTAGE', 'VAULT_LEAK',
    'CORE_OUTAGE', 'TELESCOPE_FAULT', 'SHIPYARD_REVOLT', 'PROSPECTOR_FAULT')),
  CONSTRAINT "planet_faults_slot_check" CHECK (
    "repair_slot" IS NULL OR "repair_slot" BETWEEN 0 AND 2),
  -- A half-written repair is a lane nothing can ever finish or free.
  CONSTRAINT "planet_faults_repair_pair_check" CHECK (
    ("repair_slot" IS NULL AND "repair_started_at" IS NULL AND "repair_ready_at" IS NULL)
    OR ("repair_slot" IS NOT NULL AND "repair_started_at" IS NOT NULL
        AND "repair_ready_at" IS NOT NULL))
);--> statement-breakpoint

-- The same fault cannot stand twice on one world. This index is the whole of that
-- rule: nothing else anywhere checks it.
CREATE UNIQUE INDEX IF NOT EXISTS "planet_faults_planet_kind_idx"
  ON "planet_faults" ("planet_id", "kind");--> statement-breakpoint
-- One spawn event, one fault: the guard against a redelivered worker tick.
CREATE UNIQUE INDEX IF NOT EXISTS "planet_faults_spawn_event_idx"
  ON "planet_faults" ("spawn_event_id");--> statement-breakpoint
-- Three lanes, running at the same time. Same shape as
-- `build_orders_planet_queue_slot_active_idx`, and the concurrency guard for the
-- fourth simultaneous repair.
CREATE UNIQUE INDEX IF NOT EXISTS "planet_faults_repair_slot_idx"
  ON "planet_faults" ("planet_id", "repair_slot")
  WHERE "repair_ready_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "planet_faults_planet_idx" ON "planet_faults" ("planet_id");
--> statement-breakpoint

-- The established-colony backfill runs in `runMigrations` immediately after this
-- migration commits. PostgreSQL forbids using a newly-added enum value before the
-- transaction that added it has committed (55P04), and Drizzle deliberately wraps
-- every pending migration in that same transaction.

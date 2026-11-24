-- Ay F4 (§4.3, §6.11): the Moon Gate's charge event and its "gate ready" notice. Enum values get their own migration.
ALTER TYPE "public"."event_kind" ADD VALUE 'moon_gate_ready';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'moon_gate_ready';
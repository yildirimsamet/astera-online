-- AY F3a (§6.6): the hop landing event. Its own migration: a new enum value is never used in the transaction that adds it.
ALTER TYPE "public"."event_kind" ADD VALUE 'moon_move_land';
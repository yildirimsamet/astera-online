-- KURULUŞ SAATİ'NİN İKİ ANI (plan 2026-11-20 §4): son on dakika ve saatin sonu. Additive enum values only.
ALTER TYPE "public"."event_kind" ADD VALUE 'newcomer_hour';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'newcomer_hour_ending';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'newcomer_hour_summary';

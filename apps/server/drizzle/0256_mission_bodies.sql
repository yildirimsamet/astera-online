-- Ay F3b (docs/ay-entegrasyon-plani-2026-11-19.md §4.2, V43): which body of a world a flight leaves and
-- reaches, the attacker's last planet/moon switch (V2), and the body a battle report was fought for.
-- Constant defaults are metadata-only; the CHECKs scan each table once (`missions` 13,002 rows on prod,
-- measured 2026-11-19, V32; `battle_reports` is smaller).
ALTER TABLE "battle_reports" ADD COLUMN "target_body" text DEFAULT 'PLANET' NOT NULL;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "origin_body" text DEFAULT 'PLANET' NOT NULL;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "target_body" text DEFAULT 'PLANET' NOT NULL;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "retargeted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "battle_reports" ADD CONSTRAINT "battle_reports_target_body_check" CHECK ("battle_reports"."target_body" in ('PLANET', 'MOON'));--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_origin_body_check" CHECK ("missions"."origin_body" in ('PLANET', 'MOON'));--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_target_body_check" CHECK ("missions"."target_body" in ('PLANET', 'MOON'));
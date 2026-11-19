-- AY (MOON) F2b, docs/ay-entegrasyon-plani-2026-11-19.md §4.1: one moon a world, keyed by its planet; the seed ledger
-- keeps a destroyed or carried seeded moon from coming back when its slot reopens. New tables only; dark until ruleset 20.
CREATE TABLE "moon_seed_ledger" (
	"season_id" uuid NOT NULL,
	"slot_index" integer NOT NULL,
	CONSTRAINT "moon_seed_ledger_season_id_slot_index_pk" PRIMARY KEY("season_id","slot_index")
);
--> statement-breakpoint
CREATE TABLE "moons" (
	"planet_id" uuid PRIMARY KEY NOT NULL,
	"rarity" text NOT NULL,
	"origin" text NOT NULL,
	"cracks" integer DEFAULT 0 NOT NULL,
	"last_hit_at" timestamp with time zone,
	"closed_until" timestamp with time zone,
	"gate_ready_at" timestamp with time zone,
	"visual_seed" integer NOT NULL,
	"born_at" timestamp with time zone NOT NULL,
	"born_mission_id" uuid,
	CONSTRAINT "moons_rarity_check" CHECK ("moons"."rarity" in ('COMMON', 'RARE', 'EPIC', 'LEGENDARY')),
	CONSTRAINT "moons_origin_check" CHECK ("moons"."origin" in ('SEED', 'BUILT', 'BATTLE')),
	CONSTRAINT "moons_cracks_check" CHECK ("moons"."cracks" >= 0)
);
--> statement-breakpoint
ALTER TABLE "moon_seed_ledger" ADD CONSTRAINT "moon_seed_ledger_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moons" ADD CONSTRAINT "moons_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;
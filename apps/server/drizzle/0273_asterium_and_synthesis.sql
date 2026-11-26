ALTER TYPE "public"."event_kind" ADD VALUE 'synthesis_complete';--> statement-breakpoint
ALTER TYPE "public"."galaxy_event_occurrence_kind" ADD VALUE 'ASTERIUM_STORM';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'synthesis_ready';--> statement-breakpoint
CREATE TABLE "player_asterium" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_asterium_balance_check" CHECK ("player_asterium"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "player_capsules" (
	"player_id" uuid NOT NULL,
	"capsule_id" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "player_capsules_player_id_capsule_id_pk" PRIMARY KEY("player_id","capsule_id"),
	CONSTRAINT "player_capsules_id_check" CHECK ("player_capsules"."capsule_id" in ('OPTIC_VEIL', 'SILENT_THRUST')),
	CONSTRAINT "player_capsules_quantity_check" CHECK ("player_capsules"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "synthesis_jobs" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"capsule_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"delivered" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completes_at" timestamp with time zone NOT NULL,
	"paid_alloy" integer NOT NULL,
	"paid_crystal" integer NOT NULL,
	"paid_deuterium" integer NOT NULL,
	"paid_asterium" integer NOT NULL,
	CONSTRAINT "synthesis_jobs_id_unique" UNIQUE("id"),
	CONSTRAINT "synthesis_jobs_capsule_check" CHECK ("synthesis_jobs"."capsule_id" in ('OPTIC_VEIL', 'SILENT_THRUST')),
	CONSTRAINT "synthesis_jobs_quantity_check" CHECK ("synthesis_jobs"."quantity" BETWEEN 1 AND 50),
	CONSTRAINT "synthesis_jobs_delivered_check" CHECK ("synthesis_jobs"."delivered" >= 0 AND "synthesis_jobs"."delivered" <= "synthesis_jobs"."quantity"),
	CONSTRAINT "synthesis_jobs_paid_check" CHECK ("synthesis_jobs"."paid_alloy" >= 0 AND "synthesis_jobs"."paid_crystal" >= 0 AND "synthesis_jobs"."paid_deuterium" >= 0 AND "synthesis_jobs"."paid_asterium" >= 0)
);
--> statement-breakpoint
ALTER TABLE "arena_ships" ADD COLUMN "hold_asterium" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "battle_reports" ADD COLUMN "applied_capsules" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "applied_capsules" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "moons" ADD COLUMN "asterium_synced_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "moons" ADD COLUMN "asterium_fraction" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "moons" ADD COLUMN "asterium_produced" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "synthesis_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "player_asterium" ADD CONSTRAINT "player_asterium_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_capsules" ADD CONSTRAINT "player_capsules_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synthesis_jobs" ADD CONSTRAINT "synthesis_jobs_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synthesis_jobs" ADD CONSTRAINT "synthesis_jobs_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moons" ADD CONSTRAINT "moons_asterium_fraction_check" CHECK ("moons"."asterium_fraction" >= 0 AND "moons"."asterium_fraction" < 1);--> statement-breakpoint
ALTER TABLE "moons" ADD CONSTRAINT "moons_asterium_produced_check" CHECK ("moons"."asterium_produced" >= 0);
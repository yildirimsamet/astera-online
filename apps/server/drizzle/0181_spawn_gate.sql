CREATE TABLE "spawn_gate_skips" (
	"season_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"index" integer NOT NULL,
	"appears_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone NOT NULL,
	CONSTRAINT "spawn_gate_skips_season_id_kind_index_pk" PRIMARY KEY("season_id","kind","index"),
	CONSTRAINT "spawn_gate_skips_kind_check" CHECK ("spawn_gate_skips"."kind" IN ('ASTEROID', 'PIRATE'))
);
--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "spawn_gate_from" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "spawn_gate_through" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "spawn_gate_skips" ADD CONSTRAINT "spawn_gate_skips_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spawn_gate_skips_window_idx" ON "spawn_gate_skips" USING btree ("season_id","kind","appears_at");
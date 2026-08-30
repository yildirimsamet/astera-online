CREATE TABLE "probe_world_memories" (
	"observer_player_id" uuid NOT NULL,
	"target_planet_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "probe_world_memories_observer_player_id_target_planet_id_pk" PRIMARY KEY("observer_player_id","target_planet_id")
);
--> statement-breakpoint
ALTER TABLE "probe_world_memories" ADD CONSTRAINT "probe_world_memories_observer_player_id_players_id_fk" FOREIGN KEY ("observer_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probe_world_memories" ADD CONSTRAINT "probe_world_memories_target_planet_id_planets_id_fk" FOREIGN KEY ("target_planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probe_world_memories" ADD CONSTRAINT "probe_world_memories_report_id_probe_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."probe_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "probe_world_memories_report_idx" ON "probe_world_memories" USING btree ("report_id");--> statement-breakpoint
INSERT INTO "probe_world_memories" (
	"observer_player_id",
	"target_planet_id",
	"report_id",
	"seen_at"
)
SELECT DISTINCT ON ("observer_player_id", "target_planet_id")
	"observer_player_id",
	"target_planet_id",
	"id",
	"created_at"
FROM "probe_reports"
WHERE "delivered_at" IS NOT NULL
	AND "silhouette" IS NOT NULL
ORDER BY "observer_player_id", "target_planet_id", "created_at" DESC, "id" DESC;

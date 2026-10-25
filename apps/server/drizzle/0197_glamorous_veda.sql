CREATE TABLE "battle_replays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"battle_report_id" uuid,
	"monument_battle_id" uuid,
	"attacker_visible" boolean NOT NULL,
	"status" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "battle_replays_source_check" CHECK (num_nonnulls("battle_replays"."battle_report_id", "battle_replays"."monument_battle_id") = 1),
	CONSTRAINT "battle_replays_data_check" CHECK (("battle_replays"."status" = 'AVAILABLE' AND "battle_replays"."data" IS NOT NULL)
    OR ("battle_replays"."status" IN ('TOO_LARGE', 'NOT_RECORDED') AND "battle_replays"."data" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "battle_replays" ADD CONSTRAINT "battle_replays_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_replays" ADD CONSTRAINT "battle_replays_battle_report_id_battle_reports_id_fk" FOREIGN KEY ("battle_report_id") REFERENCES "public"."battle_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_replays" ADD CONSTRAINT "battle_replays_monument_battle_id_monument_battles_id_fk" FOREIGN KEY ("monument_battle_id") REFERENCES "public"."monument_battles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "battle_replays_report_idx" ON "battle_replays" USING btree ("battle_report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "battle_replays_monument_idx" ON "battle_replays" USING btree ("monument_battle_id");--> statement-breakpoint
CREATE INDEX "battle_replays_season_idx" ON "battle_replays" USING btree ("season_id");
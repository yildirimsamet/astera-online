CREATE TABLE "vacations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"days" integer NOT NULL,
	"cost" integer NOT NULL,
	"paid_store" double precision NOT NULL,
	"paid_buffer" double precision NOT NULL,
	"quote" jsonb NOT NULL,
	CONSTRAINT "vacations_days_check" CHECK ("vacations"."days" between 1 and 7),
	CONSTRAINT "vacations_payment_check" CHECK ("vacations"."cost" >= 0 and "vacations"."paid_store" >= 0 and "vacations"."paid_buffer" >= 0 and "vacations"."paid_store" + "vacations"."paid_buffer" = "vacations"."cost"),
	CONSTRAINT "vacations_time_check" CHECK ("vacations"."ends_at" > "vacations"."started_at" and ("vacations"."ended_at" is null or "vacations"."ended_at" between "vacations"."started_at" and "vacations"."ends_at"))
);
--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "vacation_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "vacation_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "silent_space_reset_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "vacation_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vacations" ADD CONSTRAINT "vacations_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacations" ADD CONSTRAINT "vacations_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vacations_request_idx" ON "vacations" USING btree ("player_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vacations_open_idx" ON "vacations" USING btree ("player_id") WHERE "vacations"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "vacations_due_idx" ON "vacations" USING btree ("ends_at") WHERE "vacations"."ended_at" is null;
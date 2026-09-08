CREATE TABLE "return_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid,
	"player_id_snapshot" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"target_shard_id" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_reason" text,
	CONSTRAINT "return_applications_status_check" CHECK ("return_applications"."status" IN ('QUEUED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'SEASON_ENDED')),
	CONSTRAINT "return_applications_closed_check" CHECK (("return_applications"."status" = 'QUEUED' AND "return_applications"."closed_at" IS NULL AND "return_applications"."player_id" IS NOT NULL) OR ("return_applications"."status" <> 'QUEUED' AND "return_applications"."closed_at" IS NOT NULL)),
	CONSTRAINT "return_applications_sequence_check" CHECK ("return_applications"."sequence" > 0)
);
--> statement-breakpoint
CREATE TABLE "return_queue_counters" (
	"cycle_id" uuid NOT NULL,
	"target_shard_id" uuid NOT NULL,
	"last_sequence" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "return_queue_counters_cycle_id_target_shard_id_pk" PRIMARY KEY("cycle_id","target_shard_id")
);
--> statement-breakpoint
ALTER TABLE "return_applications" ADD CONSTRAINT "return_applications_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_applications" ADD CONSTRAINT "return_applications_cycle_id_season_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."season_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_applications" ADD CONSTRAINT "return_applications_target_shard_id_shards_id_fk" FOREIGN KEY ("target_shard_id") REFERENCES "public"."shards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_queue_counters" ADD CONSTRAINT "return_queue_counters_cycle_id_season_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."season_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_queue_counters" ADD CONSTRAINT "return_queue_counters_target_shard_id_shards_id_fk" FOREIGN KEY ("target_shard_id") REFERENCES "public"."shards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "return_applications_queued_player_idx" ON "return_applications" USING btree ("player_id") WHERE "return_applications"."status" = 'QUEUED';--> statement-breakpoint
CREATE UNIQUE INDEX "return_applications_sequence_idx" ON "return_applications" USING btree ("cycle_id","target_shard_id","sequence");--> statement-breakpoint
CREATE INDEX "return_applications_admission_idx" ON "return_applications" USING btree ("cycle_id","target_shard_id","status","sequence");
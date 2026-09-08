ALTER TABLE "season_results" ADD COLUMN "cycle_id" uuid;--> statement-breakpoint
UPDATE "season_results" r SET "cycle_id" = s."cycle_id" FROM "seasons" s WHERE s."id" = r."season_id";--> statement-breakpoint
ALTER TABLE "season_results" ALTER COLUMN "cycle_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "season_results" ADD CONSTRAINT "season_results_cycle_id_season_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."season_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "season_results_cycle_account_idx" ON "season_results" USING btree ("cycle_id","account_id");
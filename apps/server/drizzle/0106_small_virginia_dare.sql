ALTER TABLE "clan_war_missions" DROP CONSTRAINT "clan_war_missions_contribution_id_clan_war_contributions_id_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX "clan_war_contributions_id_operation_idx" ON "clan_war_contributions" USING btree ("id","operation_id");
--> statement-breakpoint
ALTER TABLE "clan_war_missions" ADD CONSTRAINT "clan_war_missions_contribution_operation_fk" FOREIGN KEY ("contribution_id","operation_id") REFERENCES "public"."clan_war_contributions"("id","operation_id") ON DELETE no action ON UPDATE no action;

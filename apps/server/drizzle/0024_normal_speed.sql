DO $$ BEGIN
 ALTER TABLE "strategic_assets" ADD CONSTRAINT "strategic_assets_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;

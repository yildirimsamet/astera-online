ALTER TABLE "hp_radiation_sources" DROP CONSTRAINT "hp_radiation_sources_origin_check";--> statement-breakpoint
ALTER TABLE "hp_radiation_sources" DROP CONSTRAINT "hp_radiation_sources_bomb_flight_id_radiation_bomb_flights_id_fk";
--> statement-breakpoint
ALTER TABLE "hp_radiation_sources" ADD CONSTRAINT "hp_radiation_sources_bomb_flight_id_radiation_bomb_flights_id_fk" FOREIGN KEY ("bomb_flight_id") REFERENCES "public"."radiation_bomb_flights"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hp_radiation_sources" ADD CONSTRAINT "hp_radiation_sources_origin_check" CHECK (("hp_radiation_sources"."origin" = 'ENVIRONMENT' AND "hp_radiation_sources"."bomb_flight_id" IS NULL)
    OR ("hp_radiation_sources"."origin" = 'BOMB' AND "hp_radiation_sources"."mode" = 'EMIT' AND "hp_radiation_sources"."radiation_level" IS NOT NULL AND "hp_radiation_sources"."anchor_kind" <> 'ZONE' AND "hp_radiation_sources"."active_until" IS NOT NULL));
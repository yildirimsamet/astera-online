-- KİŞİSEL KAYALAR (plan 2026-11-20 §5.2): two rocks a first game's landing lays beside the capital, for that commander alone. Additive only.
CREATE SEQUENCE "public"."personal_rock_index_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "personal_rocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"index" integer DEFAULT -nextval('personal_rock_index_seq') NOT NULL,
	"spec" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "personal_rocks_index_check" CHECK ("personal_rocks"."index" < 0)
);
--> statement-breakpoint
ALTER TABLE "personal_rocks" ADD CONSTRAINT "personal_rocks_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_rocks" ADD CONSTRAINT "personal_rocks_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "personal_rocks_index_idx" ON "personal_rocks" USING btree ("index");--> statement-breakpoint
CREATE INDEX "personal_rocks_player_idx" ON "personal_rocks" USING btree ("player_id","expires_at");
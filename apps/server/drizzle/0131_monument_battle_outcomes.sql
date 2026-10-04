CREATE TABLE "monument_battle_participants" (
	"battle_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"clan_id" uuid,
	"side" text NOT NULL,
	"wave_ids" jsonb NOT NULL,
	"fleet" jsonb NOT NULL,
	"survivors" jsonb NOT NULL,
	"losses" jsonb NOT NULL,
	"damage" jsonb NOT NULL,
	"loot_deuterium" double precision NOT NULL,
	"dominion_delta" bigint NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "monument_battle_participants_battle_id_player_id_side_pk" PRIMARY KEY("battle_id","player_id","side"),
	CONSTRAINT "monument_participants_side_check" CHECK ("monument_battle_participants"."side" IN ('ATTACK', 'DEFENCE')),
	CONSTRAINT "monument_participants_amounts_check" CHECK ("monument_battle_participants"."dominion_delta" BETWEEN -9007199254740991 AND 9007199254740991
    AND "monument_battle_participants"."loot_deuterium" >= 0 AND "monument_battle_participants"."loot_deuterium" < 'Infinity'::float8)
);
--> statement-breakpoint
CREATE TABLE "monument_battles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"monument_id" uuid NOT NULL,
	"trigger_wave_id" uuid NOT NULL,
	"attacker_fleet" jsonb NOT NULL,
	"defender_fleet" jsonb NOT NULL,
	"attacker_survivors" jsonb NOT NULL,
	"defender_survivors" jsonb NOT NULL,
	"grade" text NOT NULL,
	"rounds" jsonb NOT NULL,
	"control" text NOT NULL,
	"loot_deuterium" double precision NOT NULL,
	"loot_value" bigint NOT NULL,
	"attacker_loss_value" bigint NOT NULL,
	"defender_loss_value" bigint NOT NULL,
	"ruleset_version" integer NOT NULL,
	"eligible" boolean NOT NULL,
	"raw_exchange" bigint NOT NULL,
	"transfer" bigint NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "monument_battles_control_check" CHECK ("monument_battles"."control" IN ('ATTACKER', 'DEFENDER', 'EMPTY')),
	CONSTRAINT "monument_battles_amounts_check" CHECK ("monument_battles"."loot_deuterium" >= 0 AND "monument_battles"."loot_deuterium" < 'Infinity'::float8
    AND "monument_battles"."loot_value" BETWEEN 0 AND 9007199254740991
    AND "monument_battles"."attacker_loss_value" BETWEEN 0 AND 9007199254740991
    AND "monument_battles"."defender_loss_value" BETWEEN 0 AND 9007199254740991
    AND "monument_battles"."ruleset_version" > 0 AND "monument_battles"."transfer" BETWEEN -9007199254740991 AND 9007199254740991
    AND "monument_battles"."raw_exchange" BETWEEN -9007199254740991 AND 9007199254740991
    AND (("monument_battles"."eligible" = false AND "monument_battles"."transfer" = 0 AND "monument_battles"."raw_exchange" = 0)
      OR ("monument_battles"."eligible" = true AND "monument_battles"."raw_exchange" = "monument_battles"."loot_value" + "monument_battles"."defender_loss_value" - "monument_battles"."attacker_loss_value"
        AND ("monument_battles"."ruleset_version" < 7 OR "monument_battles"."raw_exchange" = "monument_battles"."transfer"))))
);
--> statement-breakpoint
ALTER TABLE "monuments" ADD COLUMN "garrison_template" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "monuments" ADD COLUMN "garrison_tech" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "monuments" ADD COLUMN "garrison_damage" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "monument_battle_participants" ADD CONSTRAINT "monument_battle_participants_battle_id_monument_battles_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."monument_battles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monument_battle_participants" ADD CONSTRAINT "monument_battle_participants_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monument_battles" ADD CONSTRAINT "monument_battles_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "monument_participants_season_idx" ON "monument_battle_participants" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "monument_participants_player_time_idx" ON "monument_battle_participants" USING btree ("player_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "monument_battles_trigger_idx" ON "monument_battles" USING btree ("trigger_wave_id");--> statement-breakpoint
CREATE INDEX "monument_battles_season_time_idx" ON "monument_battles" USING btree ("season_id","created_at");
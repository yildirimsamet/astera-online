ALTER TABLE "clan_war_contributions" DROP CONSTRAINT "clan_war_contributions_status_check";--> statement-breakpoint
ALTER TABLE "clan_war_operations" DROP CONSTRAINT "clan_war_operations_close_reason_check";--> statement-breakpoint
ALTER TABLE "clan_war_operations" DROP CONSTRAINT "clan_war_operations_battle_check";--> statement-breakpoint
ALTER TABLE "clan_war_operations" ALTER COLUMN "target_planet_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clan_war_operations" ALTER COLUMN "target_player_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clan_war_contributions" ADD COLUMN "shield_loss_acknowledged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clan_war_operations" ADD COLUMN "target_kind" text DEFAULT 'PLANET' NOT NULL;--> statement-breakpoint
ALTER TABLE "clan_war_operations" ADD COLUMN "target_monument_id" uuid;--> statement-breakpoint
ALTER TABLE "monument_waves" ADD COLUMN "joint_operation_id" uuid;--> statement-breakpoint
ALTER TABLE "clan_war_operations" ADD CONSTRAINT "clan_war_operations_target_monument_id_monuments_id_fk" FOREIGN KEY ("target_monument_id") REFERENCES "public"."monuments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "monument_waves_joint_idx" ON "monument_waves" USING btree ("joint_operation_id","status");--> statement-breakpoint
ALTER TABLE "clan_war_contributions" ADD CONSTRAINT "clan_war_contributions_status_check" CHECK ("clan_war_contributions"."status" IN ('OUTBOUND', 'STAGED', 'RECALL_ORDERED', 'IN_BATTLE',
      'RETURNING', 'HOME', 'LOST', 'TRANSFERRED'));--> statement-breakpoint
ALTER TABLE "clan_war_operations" ADD CONSTRAINT "clan_war_operations_target_check" CHECK (("clan_war_operations"."target_kind" = 'PLANET' AND "clan_war_operations"."target_planet_id" IS NOT NULL
    AND "clan_war_operations"."target_player_id" IS NOT NULL AND "clan_war_operations"."target_monument_id" IS NULL)
    OR ("clan_war_operations"."target_kind" = 'MONUMENT' AND "clan_war_operations"."target_monument_id" IS NOT NULL
    AND "clan_war_operations"."target_planet_id" IS NULL AND "clan_war_operations"."target_player_id" IS NULL));--> statement-breakpoint
ALTER TABLE "clan_war_operations" ADD CONSTRAINT "clan_war_operations_close_reason_check" CHECK ("clan_war_operations"."close_reason" IS NULL
      OR "clan_war_operations"."close_reason" IN ('BATTLE', 'MONUMENT', 'LEADER_CANCEL', 'EXPIRED', 'TARGET_CHANGED', 'FAILED'));--> statement-breakpoint
ALTER TABLE "clan_war_operations" ADD CONSTRAINT "clan_war_operations_battle_check" CHECK (("clan_war_operations"."resolved_at" IS NULL OR "clan_war_operations"."close_reason" IN ('BATTLE', 'MONUMENT'))
      AND ("clan_war_operations"."close_reason" IS NULL OR "clan_war_operations"."close_reason" NOT IN ('BATTLE', 'MONUMENT')
        OR ("clan_war_operations"."started_at" IS NOT NULL AND "clan_war_operations"."resolved_at" IS NOT NULL))
      AND ("clan_war_operations"."close_reason" IS DISTINCT FROM 'FAILED' OR "clan_war_operations"."started_at" IS NOT NULL));
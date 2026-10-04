ALTER TABLE "monument_waves" DROP CONSTRAINT "monument_waves_reason_check";--> statement-breakpoint
ALTER TABLE "monument_waves" ADD CONSTRAINT "monument_waves_reason_check" CHECK ("monument_waves"."return_reason" IS NULL OR "monument_waves"."return_reason"
    IN ('RECALLED', 'CAPACITY', 'MEMBERSHIP', 'CONTROL_CHANGED', 'DEFEAT', 'WORLD_CHANGED', 'FREEZE'));
ALTER TYPE "public"."notification_kind" ADD VALUE 'raid_result';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'probe_report';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'unlock';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "ref_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_ref_idx" ON "notifications" USING btree ("player_id","kind","ref_id");
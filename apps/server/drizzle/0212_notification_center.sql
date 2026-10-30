CREATE TYPE "public"."alert_timing" AS ENUM('T3', 'T5', 'T15', 'RADAR');--> statement-breakpoint
CREATE TYPE "public"."paid_alert_status" AS ENUM('PENDING', 'SENT', 'UNFUNDED', 'CANCELLED', 'NO_DEVICE');--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'paid_alert';--> statement-breakpoint
CREATE TABLE "notification_centers" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"built_at" timestamp with time zone NOT NULL,
	"wallet" integer DEFAULT 0 NOT NULL,
	"timing" "alert_timing" DEFAULT 'T5' NOT NULL,
	"muted" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "notification_centers_wallet_check" CHECK ("notification_centers"."wallet" >= 0)
);
--> statement-breakpoint
CREATE TABLE "paid_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"timing" "alert_timing",
	"send_at" timestamp with time zone NOT NULL,
	"price" integer,
	"status" "paid_alert_status" DEFAULT 'PENDING' NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "push_devices" (
	"token" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"locale" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "push_devices_locale_check" CHECK ("push_devices"."locale" in ('en','tr','de','fr','es','ja'))
);
--> statement-breakpoint
ALTER TABLE "notification_centers" ADD CONSTRAINT "notification_centers_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paid_alerts" ADD CONSTRAINT "paid_alerts_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "paid_alerts_ref_idx" ON "paid_alerts" USING btree ("player_id","kind","ref_id");--> statement-breakpoint
CREATE INDEX "paid_alerts_player_time_idx" ON "paid_alerts" USING btree ("player_id","created_at");--> statement-breakpoint
CREATE INDEX "push_devices_account_idx" ON "push_devices" USING btree ("account_id");
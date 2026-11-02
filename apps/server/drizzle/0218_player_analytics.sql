CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"visitor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"account_id" uuid,
	"player_id" uuid,
	"season_id" uuid,
	"shard_id" uuid,
	"name" text NOT NULL,
	"mode" text NOT NULL,
	"source" text NOT NULL,
	"sequence" integer NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"time_trusted" boolean NOT NULL,
	"payload_hash" text NOT NULL,
	"properties" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"visitor_id" uuid NOT NULL,
	"account_id" uuid,
	"context_id" uuid NOT NULL,
	"first_at" timestamp with time zone NOT NULL,
	"last_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_visitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credential_hash" text NOT NULL,
	"context_id" uuid NOT NULL,
	"account_id" uuid,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "analytics_visitors_credential_hash_unique" UNIQUE("credential_hash")
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_visitor_id_analytics_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."analytics_visitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_session_id_analytics_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."analytics_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD CONSTRAINT "analytics_sessions_visitor_id_analytics_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."analytics_visitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD CONSTRAINT "analytics_sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_visitors" ADD CONSTRAINT "analytics_visitors_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_account_time_idx" ON "analytics_events" USING btree ("account_id","occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_events_session_sequence_idx" ON "analytics_events" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE INDEX "analytics_events_visitor_idx" ON "analytics_events" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "analytics_events_received_idx" ON "analytics_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "analytics_sessions_account_time_idx" ON "analytics_sessions" USING btree ("account_id","last_at");--> statement-breakpoint
CREATE INDEX "analytics_sessions_visitor_idx" ON "analytics_sessions" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "analytics_visitors_account_idx" ON "analytics_visitors" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "analytics_visitors_expiry_idx" ON "analytics_visitors" USING btree ("expires_at");
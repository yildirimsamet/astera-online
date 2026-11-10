CREATE TABLE "vessel_bot_state" (
	"vessel_id" uuid PRIMARY KEY NOT NULL,
	"persona" text NOT NULL,
	"next_action_at" timestamp with time zone NOT NULL,
	"session_until_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vessel_bot_state" ADD CONSTRAINT "vessel_bot_state_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vessel_bot_state_due_idx" ON "vessel_bot_state" USING btree ("next_action_at");
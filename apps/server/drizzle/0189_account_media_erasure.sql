CREATE TABLE "media_deletion_queue" (
	"asset_id" uuid PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "media_deletion_queue_request_idx" ON "media_deletion_queue" USING btree ("request_id");
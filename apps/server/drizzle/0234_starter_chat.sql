CREATE TABLE "starter_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"starter_galaxy_id" uuid NOT NULL,
	"author_account_id" uuid NOT NULL,
	"author_vessel_id" uuid NOT NULL,
	"username" text NOT NULL,
	"language" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"masked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "vessels" ADD COLUMN "chat_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "starter_chat_messages" ADD CONSTRAINT "starter_chat_messages_starter_galaxy_id_starter_galaxies_id_fk" FOREIGN KEY ("starter_galaxy_id") REFERENCES "public"."starter_galaxies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "starter_chat_messages" ADD CONSTRAINT "starter_chat_messages_author_account_id_accounts_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "starter_chat_messages" ADD CONSTRAINT "starter_chat_messages_author_vessel_id_vessels_id_fk" FOREIGN KEY ("author_vessel_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "starter_chat_room_idx" ON "starter_chat_messages" USING btree ("starter_galaxy_id","language","created_at");
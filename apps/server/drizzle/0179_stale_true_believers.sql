ALTER TABLE "mail_outbox" DROP CONSTRAINT "mail_outbox_operation_id_security_operations_id_fk";
--> statement-breakpoint
ALTER TABLE "mail_outbox" ADD CONSTRAINT "mail_outbox_operation_id_security_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."security_operations"("id") ON DELETE set null ON UPDATE no action;